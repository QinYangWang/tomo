/**
 * Project repositories on object storage: the agent's edits become commits, a real `git`
 * client clones and pushes over smart HTTP, the local cache is disposable, and switching to
 * an S3-compatible bucket carries every repository over.
 *
 * The S3 half runs when TOMO_TEST_S3 points at an S3-compatible endpoint with a bucket
 * "tomo-test" that accepts any credentials (e.g. `moto_server -p 9010`).
 */
import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.TOMO_DATA_DIR ??= mkdtempSync(join(tmpdir(), "tomo-git-"));
process.env.NO_PROXY = process.env.no_proxy = "127.0.0.1,localhost";

const { projects } = await import("../src/app/projects.ts");
const repos = await import("../src/git/repos.ts");
const { git, readManifest } = await import("../src/git/wal.ts");

// The same routing server/http.ts does, minus auth.
const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const u = new URL(req.url);
    const m = /^\/git\/([^/]+)\.git\/(info\/refs|git-upload-pack|git-receive-pack)$/.exec(u.pathname);
    if (!m) return new Response("no", { status: 404 });
    const id = decodeURIComponent(m[1]!);
    const proto = req.headers.get("git-protocol") ?? undefined;
    if (m[2] === "info/refs") {
      const svc = u.searchParams.get("service") as "git-upload-pack";
      return new Response(await repos.advertise(id, svc, proto), { headers: { "content-type": `application/x-${svc}-advertisement` } });
    }
    let body = new Uint8Array(await req.arrayBuffer());
    if (req.headers.get("content-encoding") === "gzip") body = Bun.gunzipSync(body);
    return new Response(await repos.rpc(id, m[2] as "git-upload-pack", body, { protocol: proto }), { headers: { "content-type": `application/x-${m[2]}-result` } });
  },
});
const url = (id: string) => `http://127.0.0.1:${server.port}/git/${encodeURIComponent(id)}.git`;
const ME = { GIT_AUTHOR_NAME: "Me", GIT_AUTHOR_EMAIL: "me@x", GIT_COMMITTER_NAME: "Me", GIT_COMMITTER_EMAIL: "me@x" };
async function sh(cwd: string, ...args: string[]) {
  const r = await git(args, { cwd, env: ME });
  if (r.code !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.toString().trim();
}

test("agent commits, client clones and pushes, cache is disposable", async () => {
  const p = projects.create("Git demo");
  const work = projects.dir(p.id);

  // 1. The agent wrote a file during a turn.
  writeFileSync(join(work, "notes.md"), "# hello\n");
  const sha = await repos.afterTurn(p.id, work, "写笔记");
  expect(sha).toMatch(/^[0-9a-f]{40}$/);
  let m = await readManifest(repos.store(), p.id);
  expect(m?.seq).toBe(1);
  expect(m?.refs["refs/heads/main"]).toBe(sha!);

  // 2. A real client clones it over HTTP, commits and pushes.
  const client = mkdtempSync(join(tmpdir(), "client-"));
  await sh(client, "clone", "-q", url(p.id), "c");
  const c = join(client, "c");
  expect(readFileSync(join(c, "notes.md"), "utf8")).toBe("# hello\n");
  writeFileSync(join(c, "todo.txt"), "buy tea\n");
  await sh(c, "add", "-A");
  await sh(c, "commit", "-q", "-m", "from laptop");
  await sh(c, "push", "-q", "origin", "main");
  m = await readManifest(repos.store(), p.id);
  expect(m?.seq).toBe(2);

  // 3. The next project turn sees the pushed file, and nothing is committed when nothing changed.
  await repos.beforeTurn(p.id, work);
  expect(readFileSync(join(work, "todo.txt"), "utf8")).toBe("buy tea\n");
  expect(await repos.afterTurn(p.id, work, "noop")).toBeNull();

  // 4. Throw away the cache and the working copy: storage alone rebuilds both.
  rmSync(repos.cacheDir(p.id), { recursive: true, force: true });
  rmSync(work, { recursive: true, force: true });
  const work2 = projects.dir(p.id);
  await repos.beforeTurn(p.id, work2);
  expect(readFileSync(join(work2, "notes.md"), "utf8")).toBe("# hello\n");
  expect(readFileSync(join(work2, "todo.txt"), "utf8")).toBe("buy tea\n");
  const fresh = mkdtempSync(join(tmpdir(), "client-"));
  await sh(fresh, "clone", "-q", url(p.id), "c");
  expect(await sh(join(fresh, "c"), "log", "--format=%s")).toBe("from laptop\nTomo: 写笔记");

  // 5. A push based on an outdated clone is refused, not silently merged.
  writeFileSync(join(work2, "notes.md"), "# hello again\n");
  await repos.afterTurn(p.id, work2, "改笔记");
  writeFileSync(join(c, "todo.txt"), "buy milk\n");
  await sh(c, "commit", "-q", "-am", "stale");
  const stale = await git(["push", "-q", "origin", "main"], { cwd: c, env: ME });
  expect(stale.code).not.toBe(0);

  const info = await repos.info(p.id, work2);
  expect(info.commits[0]?.subject).toBe("Tomo: 改笔记");
  expect(info.seq).toBe(3);

  await repos.removeRepo(p.id);
  expect(await readManifest(repos.store(), p.id)).toBeNull();
}, 60_000);

const S3 = process.env.TOMO_TEST_S3;
test.skipIf(!S3)("switching to an S3-compatible bucket carries repositories over", async () => {
  await fetch(`${S3}/tomo-test`, { method: "PUT" }).catch(() => {});
  const p = projects.create("S3 demo");
  const work = projects.dir(p.id);
  writeFileSync(join(work, "a.txt"), "local first\n");
  await repos.afterTurn(p.id, work, "local");
  expect(repos.store().kind).toBe("local");

  const prefix = `t${Date.now().toString(36)}`;
  const r = await repos.setStorage({ endpoint: S3!, bucket: "tomo-test", region: "us-east-1", accessKeyId: "test", secretAccessKey: "test", prefix });
  expect(r.copied).toBeGreaterThan(0);
  expect(repos.store().kind).toBe("s3");
  expect((await readManifest(repos.store(), p.id))?.seq).toBe(1);

  // Cache gone: clone straight from the bucket, push back to it.
  rmSync(repos.cacheDir(p.id), { recursive: true, force: true });
  const client = mkdtempSync(join(tmpdir(), "client-"));
  await sh(client, "clone", "-q", url(p.id), "c");
  const c = join(client, "c");
  expect(existsSync(join(c, "a.txt"))).toBe(true);
  writeFileSync(join(c, "b.txt"), "via s3\n");
  await sh(c, "add", "-A");
  await sh(c, "commit", "-q", "-m", "s3 push");
  await sh(c, "push", "-q", "origin", "main");
  expect((await readManifest(repos.store(), p.id))?.seq).toBe(2);
  const keys = await repos.store().list(`repos/${p.id}/`);
  expect(keys.filter((k) => k.includes("/packs/")).length).toBe(2);

  await repos.beforeTurn(p.id, work);
  expect(readFileSync(join(work, "b.txt"), "utf8")).toBe("via s3\n");

  await repos.setStorage(null); // back to local, carrying the S3 history
  expect((await readManifest(repos.store(), p.id))?.seq).toBe(2);
}, 60_000);
