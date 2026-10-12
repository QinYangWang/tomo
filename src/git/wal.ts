/**
 * A git repository whose source of truth is a write-ahead log in object storage
 * (the walgit / "Continuity" shape, much simplified). Under repos/<id>/ in the bucket:
 *
 *   manifest.json        { seq, head, refs, packs }: rewritten only by compare-and-swap (If-Match).
 *                        The CAS is the commit point; nothing before it is visible.
 *   log/<seq>.json       immutable record of each push (who/when/which refs/which pack)
 *   packs/<sha256>.pack  immutable, content-addressed packfiles
 *
 * The bare repository on local disk is only a cache: sync() asks the bucket whether the
 * manifest changed (conditional GET), downloads the packs it lacks and rewrites the refs to
 * match. A push is accepted by upstream `git receive-pack`; its pre-receive hook (hook.ts)
 * calls publish(), which packs the new objects, uploads them and CASes the manifest, so the
 * client only sees "ok" after the bucket does. Losing the local disk loses nothing.
 *
 * This module has no database access: the hook runs it in a separate process.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PreconditionFailed, type ObjectStore } from "./store.ts";

export const ZERO = "0000000000000000000000000000000000000000";
export type Manifest = { v: 1; seq: number; head: string; refs: Record<string, string>; packs: string[] };
export type RefUpdate = { old: string; new: string; ref: string };
const EMPTY: Manifest = { v: 1, seq: 0, head: "refs/heads/main", refs: {}, packs: [] };

export const keys = {
  root: (id: string) => `repos/${id}/`,
  manifest: (id: string) => `repos/${id}/manifest.json`,
  log: (id: string, seq: number) => `repos/${id}/log/${String(seq).padStart(10, "0")}.json`,
  pack: (id: string, hash: string) => `repos/${id}/packs/${hash}.pack`,
};

export const validId = (id: string) => /^[\p{L}\p{N}][\p{L}\p{N}._-]{0,80}$/u.test(id) && !id.includes("..");

// ---------------------------------------------------------------- git plumbing

export type Run = { code: number; stdout: Buffer; stderr: string };
export function git(args: string[], opts: { cwd?: string; input?: Uint8Array | string; env?: Record<string, string> } = {}): Promise<Run> {
  return new Promise((resolve, reject) => {
    const p = spawn("git", args, { cwd: opts.cwd, env: { ...process.env, ...opts.env } });
    const out: Buffer[] = [];
    let err = "";
    p.stdout.on("data", (d: Buffer) => out.push(d));
    p.stderr.on("data", (d: Buffer) => (err += d.toString()));
    p.on("error", reject);
    p.on("close", (code) => resolve({ code: code ?? 1, stdout: Buffer.concat(out), stderr: err }));
    p.stdin.on("error", () => {});
    p.stdin.end(opts.input ?? "");
  });
}
async function gitOk(args: string[], opts: Parameters<typeof git>[1] = {}) {
  const r = await git(args, opts);
  if (r.code !== 0) throw new Error(`git ${args[0]} failed: ${r.stderr.trim().slice(0, 400)}`);
  return r.stdout;
}

// ---------------------------------------------------------------- local cache

type SyncState = { etag?: string; packs: string[] };
const statePath = (dir: string) => join(dir, "tomo-sync.json");
export const readState = (dir: string): SyncState => {
  try {
    return JSON.parse(readFileSync(statePath(dir), "utf8"));
  } catch {
    return { packs: [] };
  }
};
export const writeState = (dir: string, s: SyncState) => writeFileSync(statePath(dir), JSON.stringify(s));

/** Creates the bare cache if needed and (re)installs the pre-receive hook. */
export async function ensureCache(dir: string, hookCommand: string) {
  if (!existsSync(join(dir, "HEAD"))) {
    mkdirSync(dir, { recursive: true });
    await gitOk(["init", "--bare", "-q", "-b", "main", dir]);
    await gitOk(["-C", dir, "config", "receive.unpackLimit", "0"]); // keep pushes as packs
    await gitOk(["-C", dir, "config", "uploadpack.allowFilter", "true"]);
    await gitOk(["-C", dir, "config", "uploadpack.allowAnySHA1InWant", "true"]);
  }
  const hook = join(dir, "hooks", "pre-receive");
  mkdirSync(join(dir, "hooks"), { recursive: true });
  const body = `#!/bin/sh\nexec ${hookCommand}\n`;
  if (!existsSync(hook) || readFileSync(hook, "utf8") !== body) {
    writeFileSync(hook, body);
    chmodSync(hook, 0o755);
  }
}

/** Brings the cache up to date with the bucket. Returns the manifest it now mirrors. */
export async function sync(store: ObjectStore, id: string, dir: string): Promise<Manifest> {
  const state = readState(dir);
  const got = await store.get(keys.manifest(id), state.etag);
  if (!got && state.etag) return currentManifest(dir);
  const m: Manifest = got ? JSON.parse(new TextDecoder().decode(got.body)) : EMPTY;
  for (const hash of m.packs) {
    if (state.packs.includes(hash)) continue;
    const pack = await store.get(keys.pack(id, hash));
    if (!pack) throw new Error(`pack ${hash} is listed in the manifest but missing from storage`);
    await gitOk(["-C", dir, "index-pack", "--stdin", "--fix-thin"], { input: pack.body });
    state.packs.push(hash);
  }
  writeRefs(dir, m);
  writeState(dir, { etag: got?.etag, packs: state.packs });
  writeFileSync(join(dir, "tomo-manifest.json"), JSON.stringify(m));
  return m;
}
const currentManifest = (dir: string): Manifest => {
  try {
    return JSON.parse(readFileSync(join(dir, "tomo-manifest.json"), "utf8"));
  } catch {
    return EMPTY;
  }
};

/** Refs become exactly the manifest's: one packed-refs file, no loose refs. */
function writeRefs(dir: string, m: Manifest) {
  for (const d of ["refs/heads", "refs/tags"]) {
    rmSync(join(dir, d), { recursive: true, force: true });
    mkdirSync(join(dir, d), { recursive: true });
  }
  const lines = Object.entries(m.refs)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([ref, sha]) => `${sha} ${ref}\n`);
  writeFileSync(join(dir, "packed-refs"), `# pack-refs with: sorted \n${lines.join("")}`);
  writeFileSync(join(dir, "HEAD"), `ref: ${m.head}\n`);
}

// ---------------------------------------------------------------- publish (runs in the pre-receive hook)

const objectCount = (pack: Buffer) => (pack.length >= 12 ? pack.readUInt32BE(8) : 0);

/**
 * Makes a push durable: uploads its objects as one pack, appends a log entry and CASes the
 * manifest. Rejects when a ref moved in the bucket since the client looked (someone else
 * pushed first). Retries the CAS when it loses a race that didn't touch these refs.
 */
export async function publish(store: ObjectStore, id: string, updates: RefUpdate[], opts: { cwd: string; env?: Record<string, string>; by?: string }): Promise<Manifest> {
  let packHash: string | null | undefined;
  for (let attempt = 0; attempt < 8; attempt++) {
    const got = await store.get(keys.manifest(id));
    const m: Manifest = got ? JSON.parse(new TextDecoder().decode(got.body)) : EMPTY;
    for (const u of updates) {
      if ((m.refs[u.ref] ?? ZERO) !== u.old) throw new Error(`${u.ref} changed in storage since you fetched; pull and push again`);
    }
    if (packHash === undefined) {
      const wants = updates.filter((u) => u.new !== ZERO).map((u) => u.new);
      const haves = Object.values(m.refs).map((s) => `^${s}`);
      packHash = null;
      if (wants.length) {
        const pack = await gitOk(["pack-objects", "--revs", "--stdout", "-q"], { cwd: opts.cwd, env: opts.env, input: [...wants, ...haves].join("\n") + "\n" });
        if (objectCount(pack) > 0) {
          packHash = createHash("sha256").update(pack).digest("hex");
          try {
            await store.put(keys.pack(id, packHash), pack, { ifNoneMatch: "*" });
          } catch (e) {
            if (!(e instanceof PreconditionFailed)) throw e; // same content already there
          }
        }
      }
    }
    const refs = { ...m.refs };
    for (const u of updates) {
      if (u.new === ZERO) delete refs[u.ref];
      else refs[u.ref] = u.new;
    }
    const next: Manifest = { v: 1, seq: m.seq + 1, head: m.head, refs, packs: packHash && !m.packs.includes(packHash) ? [...m.packs, packHash] : m.packs };
    try {
      await store.put(keys.log(id, next.seq), JSON.stringify({ seq: next.seq, at: new Date().toISOString(), by: opts.by ?? "push", updates, pack: packHash }), { ifNoneMatch: "*" });
      await store.put(keys.manifest(id), JSON.stringify(next), got ? { ifMatch: got.etag } : { ifNoneMatch: "*" });
      return next;
    } catch (e) {
      if (!(e instanceof PreconditionFailed)) throw e;
      await Bun.sleep(50 * (attempt + 1));
    }
  }
  throw new Error("storage is busy (too many concurrent pushes); try again");
}

export async function readManifest(store: ObjectStore, id: string): Promise<Manifest | null> {
  const got = await store.get(keys.manifest(id));
  return got ? JSON.parse(new TextDecoder().decode(got.body)) : null;
}

/** Copies every repository object from one store to another (used when the owner switches storage). */
export async function copyAll(from: ObjectStore, to: ObjectStore): Promise<number> {
  const existing = new Set(await to.list("repos/"));
  let n = 0;
  // Packs and logs first, manifests last, so a reader of `to` never sees a manifest whose packs are missing.
  const all = (await from.list("repos/")).sort((a, b) => Number(a.endsWith("manifest.json")) - Number(b.endsWith("manifest.json")));
  for (const k of all) {
    if (existing.has(k) && !k.endsWith("manifest.json")) continue;
    const got = await from.get(k);
    if (!got) continue;
    await to.put(k, got.body);
    n++;
  }
  return n;
}
