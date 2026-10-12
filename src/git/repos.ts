/**
 * One git repository per project, durable in object storage (see wal.ts).
 *
 *  - Storage: the S3-compatible bucket saved in Settings → 存储 (or TOMO_S3_* env vars);
 *    without one, a local folder (data/objects) with the same semantics.
 *  - Cache: data/git/<id>.git, a bare repo that can be thrown away at any time.
 *  - Working copy: the project's directory (where the agent's tools run) is a clone of the
 *    cache. Before a project turn it fast-forwards to what was pushed; after the turn the
 *    agent's changes are committed and pushed, which publishes them like any other push.
 *  - Smart HTTP (server/http.ts mounts /git/<id>.git/*): git clone / fetch / push.
 */
import { existsSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { settings, secrets } from "../app/settings.ts";
import { config } from "../config.ts";
import { LocalStore, probe, S3Store, type ObjectStore, type S3Config } from "./store.ts";
import { copyAll, ensureCache, git, keys, readManifest, readState, sync, validId, writeState } from "./wal.ts";

// ---------------------------------------------------------------- storage settings

export type StorageSettings = Omit<S3Config, "secretAccessKey">;
const SECRET = "storage:s3:secret";

function envS3(): S3Config | null {
  const e = process.env;
  if (!e.TOMO_S3_ENDPOINT || !e.TOMO_S3_BUCKET || !e.TOMO_S3_ACCESS_KEY_ID || !e.TOMO_S3_SECRET_ACCESS_KEY) return null;
  return { endpoint: e.TOMO_S3_ENDPOINT, bucket: e.TOMO_S3_BUCKET, region: e.TOMO_S3_REGION ?? "auto", accessKeyId: e.TOMO_S3_ACCESS_KEY_ID, secretAccessKey: e.TOMO_S3_SECRET_ACCESS_KEY, prefix: e.TOMO_S3_PREFIX };
}

export const storageSettings = {
  /** The S3 config in effect: UI-saved first, env second, null = local folder. */
  s3(): S3Config | null {
    const s = settings.get<StorageSettings | null>("storage:s3", null);
    const secret = secrets.get(SECRET);
    if (s && secret) return { ...s, secretAccessKey: secret };
    return envS3();
  },
  view() {
    const s = settings.get<StorageSettings | null>("storage:s3", null);
    const env = !s && envS3();
    const cur = s ?? (env ? { ...env, secretAccessKey: undefined } : null);
    return {
      kind: this.s3() ? ("s3" as const) : ("local" as const),
      fromEnv: !!env,
      s3: cur ? { endpoint: cur.endpoint, bucket: cur.bucket, region: cur.region, accessKeyId: cur.accessKeyId, prefix: cur.prefix ?? "" } : null,
      secret: s ? secrets.preview(SECRET) : { set: !!env },
      localDir: localRoot(),
    };
  },
};

const localRoot = () => join(config.dataDir, "objects");
const hookEntry = resolve(import.meta.dir, "hook.ts");

let cached: { sig: string; store: ObjectStore } | undefined;
export function store(): ObjectStore {
  const s3 = storageSettings.s3();
  const sig = JSON.stringify(s3 ?? { local: localRoot() });
  if (cached?.sig !== sig) cached = { sig, store: s3 ? new S3Store(s3) : new LocalStore(localRoot()) };
  return cached.store;
}
const storeEnv = (): string => JSON.stringify(storageSettings.s3() ? { kind: "s3", ...storageSettings.s3() } : { kind: "local", root: localRoot() });

/**
 * Switches storage: proves the new bucket works, copies every repository into it, then saves.
 * `s3: null` goes back to the local folder. Throws (and changes nothing) when the bucket fails.
 */
export async function setStorage(next: (StorageSettings & { secretAccessKey?: string }) | null): Promise<{ copied: number }> {
  const from = store();
  let to: ObjectStore;
  let cfg: S3Config | null = null;
  if (next) {
    const secret = next.secretAccessKey?.trim() || secrets.get(SECRET);
    if (!secret) throw new Error("请填写密钥");
    cfg = { endpoint: next.endpoint.trim(), bucket: next.bucket.trim(), region: next.region?.trim() || "auto", accessKeyId: next.accessKeyId.trim(), secretAccessKey: secret, prefix: next.prefix?.trim() || undefined };
    if (!/^https?:\/\//.test(cfg.endpoint) || !cfg.bucket || !cfg.accessKeyId) throw new Error("地址、存储桶和访问 ID 都要填");
    to = new S3Store(cfg);
  } else {
    to = new LocalStore(localRoot());
  }
  await probe(to);
  const copied = await withAllLocks(() => copyAll(from, to));
  if (cfg) {
    const { secretAccessKey, ...plain } = cfg;
    settings.set("storage:s3", plain);
    secrets.set(SECRET, secretAccessKey);
  } else {
    settings.delete("storage:s3");
    secrets.delete(SECRET);
  }
  // ETags belong to the old store: forget them so every cache re-reads its manifest once.
  for (const d of existsSync(cacheRoot()) ? readdirSync(cacheRoot()) : []) writeState(join(cacheRoot(), d), { packs: readState(join(cacheRoot(), d)).packs });
  return { copied };
}

export async function testStorage(next: StorageSettings & { secretAccessKey?: string }): Promise<void> {
  const secret = next.secretAccessKey?.trim() || secrets.get(SECRET);
  if (!secret) throw new Error("请填写密钥");
  await probe(new S3Store({ ...next, region: next.region || "auto", secretAccessKey: secret }));
}

// ---------------------------------------------------------------- per-repo locks

const locks = new Map<string, Promise<unknown>>();
export function withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(id) ?? Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  const tail = run.catch(() => {});
  locks.set(id, tail);
  void tail.then(() => locks.get(id) === tail && locks.delete(id));
  return run;
}
async function withAllLocks<T>(fn: () => Promise<T>): Promise<T> {
  await Promise.all([...locks.values()].map((p) => p.catch(() => {})));
  return fn();
}

// ---------------------------------------------------------------- cache

const cacheRoot = () => join(config.dataDir, "git");
export const cacheDir = (id: string) => join(cacheRoot(), `${id}.git`);

/** Up-to-date bare cache for a repo. Call inside withLock. */
async function fresh(id: string) {
  if (!validId(id)) throw new Error("bad repository id");
  const dir = cacheDir(id);
  await ensureCache(dir, `"${process.execPath}" "${hookEntry}"`);
  await sync(store(), id, dir);
  return dir;
}

const pkt = (s: string) => (s.length + 4).toString(16).padStart(4, "0") + s;

/** GET info/refs: the ref advertisement for upload-pack or receive-pack. */
export function advertise(id: string, service: "git-upload-pack" | "git-receive-pack", protocol?: string): Promise<Uint8Array> {
  return withLock(id, async () => {
    const dir = await fresh(id);
    const r = await git([service.slice(4), "--stateless-rpc", "--advertise-refs", dir], { env: protocol ? { GIT_PROTOCOL: protocol } : {} });
    if (r.code !== 0) throw new Error(r.stderr);
    // Protocol v2 replies carry no service header.
    const head = protocol?.includes("version=2") ? "" : `${pkt(`# service=${service}\n`)}0000`;
    return Buffer.concat([Buffer.from(head), r.stdout]);
  });
}

/** POST git-upload-pack / git-receive-pack: one stateless RPC round. */
export function rpc(id: string, service: "git-upload-pack" | "git-receive-pack", body: Uint8Array, opts: { protocol?: string; by?: string } = {}): Promise<Uint8Array> {
  return withLock(id, async () => {
    const dir = await fresh(id);
    const env: Record<string, string> = { TOMO_GIT_REPO: id, TOMO_GIT_STORE: storeEnv(), TOMO_GIT_BY: opts.by ?? "http" };
    if (opts.protocol) env.GIT_PROTOCOL = opts.protocol;
    const r = await git([service.slice(4), "--stateless-rpc", dir], { input: body, env });
    if (r.code !== 0 && !r.stdout.length) throw new Error(r.stderr);
    return r.stdout;
  });
}

// ---------------------------------------------------------------- working copy (the project's directory)

const AUTHOR = { GIT_AUTHOR_NAME: "Tomo", GIT_AUTHOR_EMAIL: "tomo@localhost", GIT_COMMITTER_NAME: "Tomo", GIT_COMMITTER_EMAIL: "tomo@localhost" };
const IGNORE = ["node_modules/", ".venv/", "__pycache__/", ".DS_Store", "*.log", ".env", ".env.*", ""].join("\n");

async function wc(dir: string, args: string[], env: Record<string, string> = {}) {
  return git(args, { cwd: dir, env: { ...AUTHOR, ...env } });
}

async function ensureWorkCopy(id: string, dir: string) {
  if (existsSync(join(dir, ".git"))) return;
  await wc(dir, ["init", "-q", "-b", "main"]);
  await wc(dir, ["remote", "add", "origin", cacheDir(id)]);
  if (!existsSync(join(dir, ".gitignore"))) writeFileSync(join(dir, ".gitignore"), IGNORE);
}

/** Before a project turn: pull in anything pushed from outside, keeping local edits. */
export async function beforeTurn(id: string, dir: string): Promise<void> {
  await withLock(id, async () => {
    await fresh(id);
    await ensureWorkCopy(id, dir);
    if ((await wc(dir, ["fetch", "-q", "origin"])).code !== 0) return;
    if ((await wc(dir, ["rev-parse", "-q", "--verify", "refs/remotes/origin/main"])).code !== 0) return; // nothing pushed yet
    const hasHead = (await wc(dir, ["rev-parse", "-q", "--verify", "HEAD"])).code === 0;
    if (!hasHead) {
      // Adopt the pushed history; files already on disk win, files only in the repo are restored.
      await wc(dir, ["reset", "-q", "origin/main"]);
      const missing = (await wc(dir, ["ls-files", "--deleted", "-z"])).stdout.toString().split("\0").filter(Boolean);
      if (missing.length) await wc(dir, ["checkout", "-q", "--", ...missing]);
      return;
    }
    await commitAll(dir, "Tomo: 保存改动");
    const r = await wc(dir, ["rebase", "-q", "origin/main"]);
    if (r.code !== 0) await wc(dir, ["rebase", "--abort"]);
  });
}

async function commitAll(dir: string, message: string): Promise<boolean> {
  await wc(dir, ["add", "-A"]);
  if ((await wc(dir, ["diff", "--cached", "--quiet"])).code === 0) return false;
  return (await wc(dir, ["commit", "-q", "-m", message])).code === 0;
}

/** After a project turn: commit what the agent changed and publish it. Returns the new commit, if any. */
export async function afterTurn(id: string, dir: string, summary: string): Promise<string | null> {
  return withLock(id, async () => {
    await fresh(id);
    await ensureWorkCopy(id, dir);
    const committed = await commitAll(dir, `Tomo: ${summary}`);
    const ahead = await wc(dir, ["rev-list", "--count", "origin/main..HEAD"]);
    if (!committed && ahead.code === 0 && ahead.stdout.toString().trim() === "0") return null;
    const env = { TOMO_GIT_REPO: id, TOMO_GIT_STORE: storeEnv(), TOMO_GIT_BY: "tomo" };
    let push = await wc(dir, ["push", "-q", "origin", "HEAD:refs/heads/main"], env);
    if (push.code !== 0) {
      // Someone pushed during the turn: replay ours on top and try once more.
      await wc(dir, ["fetch", "-q", "origin"]);
      const rb = await wc(dir, ["rebase", "-q", "origin/main"]);
      if (rb.code !== 0) {
        await wc(dir, ["rebase", "--abort"]);
        console.error(`[git] ${id}: could not rebase onto pushed changes; commit kept locally`);
        return null;
      }
      push = await wc(dir, ["push", "-q", "origin", "HEAD:refs/heads/main"], env);
      if (push.code !== 0) {
        console.error(`[git] ${id}: push failed: ${push.stderr.trim()}`);
        return null;
      }
    }
    return (await wc(dir, ["rev-parse", "HEAD"])).stdout.toString().trim();
  });
}

// ---------------------------------------------------------------- info / lifecycle

export type RepoInfo = { storage: "s3" | "local"; seq: number; branch: string; head: string | null; commits: { sha: string; subject: string; at: number }[] };

export async function info(id: string, dir: string): Promise<RepoInfo> {
  const m = await readManifest(store(), id).catch(() => null);
  const commits: RepoInfo["commits"] = [];
  if (existsSync(join(dir, ".git"))) {
    const log = await wc(dir, ["log", "-n", "8", "--format=%H%x09%ct%x09%s", "HEAD"]);
    if (log.code === 0)
      for (const l of log.stdout.toString().split("\n").filter(Boolean)) {
        const [sha, at, ...s] = l.split("\t");
        commits.push({ sha: sha!, at: Number(at) * 1000, subject: s.join("\t") });
      }
  }
  return { storage: store().kind, seq: m?.seq ?? 0, branch: "main", head: m?.refs["refs/heads/main"] ?? null, commits };
}

/** Deletes a repository from storage and its local cache. */
export async function removeRepo(id: string) {
  if (!validId(id)) return;
  await withLock(id, async () => {
    const s = store();
    for (const k of await s.list(keys.root(id))) await s.delete(k);
    rmSync(cacheDir(id), { recursive: true, force: true });
  });
}
