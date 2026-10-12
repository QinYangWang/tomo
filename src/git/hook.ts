/**
 * pre-receive hook for project repositories. git runs it after receiving a push (objects
 * still in quarantine) and before updating any ref; a non-zero exit rejects the whole push.
 * It publishes the push to object storage (wal.publish); only then may git accept it.
 *
 * Configuration arrives in the environment from the Tomo process that spawned git:
 *   TOMO_GIT_REPO   repository id
 *   TOMO_GIT_STORE  JSON {kind:"local", root} | {kind:"s3", ...S3Config}
 *   TOMO_GIT_BY     who pushed (for the log)
 */
import { LocalStore, S3Store } from "./store.ts";
import { publish, readState, writeState, type RefUpdate } from "./wal.ts";

const id = process.env.TOMO_GIT_REPO;
const cfg = process.env.TOMO_GIT_STORE;
if (!id || !cfg) {
  console.error("Tomo: this repository only accepts pushes through Tomo");
  process.exit(1);
}
const c = JSON.parse(cfg);
const store = c.kind === "s3" ? new S3Store(c) : new LocalStore(c.root);

const input = await new Response(Bun.stdin.stream()).text();
const updates: RefUpdate[] = input
  .split("\n")
  .filter(Boolean)
  .map((l) => {
    const [old, nw, ref] = l.split(" ");
    return { old: old!, new: nw!, ref: ref! };
  });

const dir = process.cwd(); // git runs hooks in the bare repository
try {
  const m = await publish(store, id, updates, { cwd: dir, by: process.env.TOMO_GIT_BY });
  const s = readState(dir);
  for (const p of m.packs) if (!s.packs.includes(p)) s.packs.push(p);
  // The etag is unknown here; dropping it makes the next sync re-read the manifest once.
  writeState(dir, { packs: s.packs });
  console.error(`Tomo: saved to ${store.kind === "s3" ? "S3" : "local storage"} (#${m.seq})`);
} catch (e) {
  console.error(`Tomo: ${(e as Error).message}`);
  process.exit(1);
}
