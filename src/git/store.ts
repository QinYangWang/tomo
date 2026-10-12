/**
 * Object storage for project repositories: any S3-compatible bucket (AWS S3, Cloudflare R2,
 * MinIO, ...) or, when none is configured, a local folder with the same semantics.
 *
 * Only the operations the git WAL needs: get (optionally conditional on an ETag), put
 * (optionally compare-and-swap with If-Match / create-only with If-None-Match: *), list and
 * delete. The S3 client signs requests itself (SigV4, path-style URLs), so it works against
 * every S3-compatible endpoint without an SDK.
 */
import { createHash, createHmac } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

export type Got = { body: Uint8Array; etag: string };
export type PutOpts = { ifMatch?: string; ifNoneMatch?: "*" };

/** A conditional put lost its race (HTTP 412 or 409). */
export class PreconditionFailed extends Error {
  constructor(key: string) {
    super(`precondition failed: ${key}`);
  }
}

export interface ObjectStore {
  readonly kind: "s3" | "local";
  /** null when missing; also null when `ifNoneMatch` still matches (not modified). */
  get(key: string, ifNoneMatch?: string): Promise<Got | null>;
  put(key: string, body: Uint8Array | string, opts?: PutOpts): Promise<string>;
  list(prefix: string): Promise<string[]>;
  delete(key: string): Promise<void>;
}

const sha256 = (b: Uint8Array | string) => createHash("sha256").update(b).digest("hex");
const enc = (b: Uint8Array | string) => (typeof b === "string" ? new TextEncoder().encode(b) : b);

// ---------------------------------------------------------------- local folder

/** Same contract as S3, on disk. ETag = sha256 of the content; CAS is atomic within one process (writes are serialized). */
export class LocalStore implements ObjectStore {
  readonly kind = "local" as const;
  private chain: Promise<unknown> = Promise.resolve();
  constructor(readonly root: string) {
    mkdirSync(root, { recursive: true });
  }
  private path(key: string) {
    if (key.includes("..")) throw new Error("bad key");
    return join(this.root, key);
  }
  async get(key: string, ifNoneMatch?: string): Promise<Got | null> {
    const p = this.path(key);
    if (!existsSync(p)) return null;
    const body = new Uint8Array(readFileSync(p));
    const etag = sha256(body);
    return ifNoneMatch === etag ? null : { body, etag };
  }
  put(key: string, body: Uint8Array | string, opts: PutOpts = {}): Promise<string> {
    const run = this.chain.then(() => {
      const p = this.path(key);
      const exists = existsSync(p);
      if (opts.ifNoneMatch === "*" && exists) throw new PreconditionFailed(key);
      if (opts.ifMatch !== undefined && (!exists || sha256(readFileSync(p)) !== opts.ifMatch)) throw new PreconditionFailed(key);
      mkdirSync(dirname(p), { recursive: true });
      const tmp = `${p}.tmp-${process.pid}-${Date.now()}`;
      writeFileSync(tmp, enc(body));
      renameSync(tmp, p);
      return sha256(enc(body));
    });
    this.chain = run.catch(() => {});
    return run;
  }
  async list(prefix: string): Promise<string[]> {
    const out: string[] = [];
    const walk = (d: string) => {
      if (!existsSync(d)) return;
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (!n.includes(".tmp-")) out.push(relative(this.root, p).split("\\").join("/"));
      }
    };
    walk(this.root);
    return out.filter((k) => k.startsWith(prefix)).sort();
  }
  async delete(key: string) {
    rmSync(this.path(key), { force: true });
  }
}

// ---------------------------------------------------------------- S3-compatible

export type S3Config = {
  /** e.g. https://<account>.r2.cloudflarestorage.com, https://s3.us-east-1.amazonaws.com, http://localhost:9000 */
  endpoint: string;
  bucket: string;
  /** "auto" for R2. */
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Optional key prefix inside the bucket, so one bucket can hold several Tomos. */
  prefix?: string;
};

const rfc3986 = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export class S3Store implements ObjectStore {
  readonly kind = "s3" as const;
  private base: URL;
  constructor(readonly cfg: S3Config) {
    this.base = new URL(cfg.endpoint.replace(/\/+$/, ""));
  }
  private full(key: string) {
    const p = (this.cfg.prefix ?? "").replace(/^\/+|\/+$/g, "");
    return p ? `${p}/${key}` : key;
  }

  private async send(method: string, key: string | null, opts: { query?: Record<string, string>; headers?: Record<string, string>; body?: Uint8Array } = {}) {
    const body = opts.body ?? new Uint8Array();
    const path = `/${rfc3986(this.cfg.bucket)}${key === null ? "" : `/${key.split("/").map(rfc3986).join("/")}`}`;
    const basePath = this.base.pathname === "/" ? "" : this.base.pathname;
    const canonPath = basePath + path;
    const query = Object.entries(opts.query ?? {})
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${rfc3986(k)}=${rfc3986(v)}`)
      .join("&");
    const now = new Date();
    const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, "");
    const day = amzDate.slice(0, 8);
    const payloadHash = sha256(body);
    const headers: Record<string, string> = {
      host: this.base.host,
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      ...Object.fromEntries(Object.entries(opts.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v])),
    };
    const names = Object.keys(headers).sort();
    const canonical = [method, canonPath, query, names.map((n) => `${n}:${headers[n]!.trim()}\n`).join(""), names.join(";"), payloadHash].join("\n");
    const scope = `${day}/${this.cfg.region || "us-east-1"}/s3/aws4_request`;
    const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
    let k: Buffer = createHmac("sha256", `AWS4${this.cfg.secretAccessKey}`).update(day).digest();
    for (const part of [this.cfg.region || "us-east-1", "s3", "aws4_request"]) k = createHmac("sha256", k).update(part).digest();
    const sig = createHmac("sha256", k).update(toSign).digest("hex");
    headers.authorization = `AWS4-HMAC-SHA256 Credential=${this.cfg.accessKeyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${sig}`;
    delete headers.host;
    const url = `${this.base.origin}${canonPath}${query ? `?${query}` : ""}`;
    return fetch(url, { method, headers, body: method === "GET" || method === "HEAD" || method === "DELETE" ? undefined : body });
  }

  private async fail(r: Response, what: string): Promise<never> {
    const t = await r.text().catch(() => "");
    const code = /<Code>([^<]+)<\/Code>/.exec(t)?.[1];
    const msg = /<Message>([^<]+)<\/Message>/.exec(t)?.[1];
    throw new Error(`S3 ${what}: ${r.status} ${code ?? ""} ${msg ?? ""}`.trim());
  }

  async get(key: string, ifNoneMatch?: string): Promise<Got | null> {
    const r = await this.send("GET", this.full(key), { headers: ifNoneMatch ? { "if-none-match": `"${ifNoneMatch}"` } : {} });
    if (r.status === 404 || r.status === 304) return null;
    if (!r.ok) return this.fail(r, `get ${key}`);
    return { body: new Uint8Array(await r.arrayBuffer()), etag: (r.headers.get("etag") ?? "").replace(/"/g, "") };
  }

  async put(key: string, body: Uint8Array | string, opts: PutOpts = {}): Promise<string> {
    const headers: Record<string, string> = { "content-type": "application/octet-stream" };
    if (opts.ifMatch !== undefined) headers["if-match"] = `"${opts.ifMatch}"`;
    if (opts.ifNoneMatch) headers["if-none-match"] = "*";
    const r = await this.send("PUT", this.full(key), { headers, body: enc(body) });
    if (r.status === 412 || r.status === 409) throw new PreconditionFailed(key);
    if (!r.ok) return this.fail(r, `put ${key}`);
    return (r.headers.get("etag") ?? "").replace(/"/g, "");
  }

  async list(prefix: string): Promise<string[]> {
    const out: string[] = [];
    const strip = this.full("");
    let token: string | undefined;
    do {
      const q: Record<string, string> = { "list-type": "2", prefix: this.full(prefix) };
      if (token) q["continuation-token"] = token;
      const r = await this.send("GET", null, { query: q });
      if (!r.ok) return this.fail(r, `list ${prefix}`);
      const xml = await r.text();
      for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) out.push(unxml(m[1]!).slice(strip.length));
      token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? unxml(/<NextContinuationToken>([^<]+)</.exec(xml)?.[1] ?? "") : undefined;
    } while (token);
    return out;
  }

  async delete(key: string) {
    const r = await this.send("DELETE", this.full(key));
    if (!r.ok && r.status !== 404) return this.fail(r, `delete ${key}`);
  }
}

const unxml = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");

/** Round trip that proves a bucket is usable for the WAL: write, conditional overwrite, read, delete. */
export async function probe(store: ObjectStore): Promise<void> {
  const key = `tomo-probe/${Date.now().toString(36)}`;
  const e1 = await store.put(key, "1", { ifNoneMatch: "*" });
  let casWorks = false;
  try {
    await store.put(key, "x", { ifMatch: "0000" });
  } catch (e) {
    casWorks = e instanceof PreconditionFailed;
  }
  await store.put(key, "2", { ifMatch: e1 });
  const got = await store.get(key);
  await store.delete(key);
  if (new TextDecoder().decode(got?.body) !== "2") throw new Error("read back a different value");
  if (!casWorks) throw new Error("this storage ignores conditional writes (If-Match)");
}
