/**
 * Restore a Tomo backup into a data folder. Run it before starting Tomo:
 *
 *   bun run src/restore.ts --code ABCD-EFGH-...            newest backup from TOMO_S3_* storage
 *   bun run src/restore.ts --code ... --backup backups/20261012T040000Z.tomobk
 *   bun run src/restore.ts --code ... --local /old/data/objects    from a local backup folder
 *   bun run src/restore.ts --list                           show the backups available
 *
 * Options: --data <dir> (default TOMO_DATA_DIR or ./data), --force to replace an existing
 * data folder (the old one is kept beside it as data.before-restore-<time>).
 * Project repositories in a bucket are not in the backup: they are already there, and
 * Tomo rebuilds its local copies on first use.
 */
import { existsSync, mkdirSync, renameSync } from "node:fs";
import { join, resolve } from "node:path";
import { open, untarTo } from "./backup/archive.ts";
import { LocalStore, S3Store, type ObjectStore } from "./git/store.ts";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name: string) => args.includes(`--${name}`);
const die = (msg: string): never => {
  console.error(msg);
  process.exit(1);
};

const dataDir = resolve(opt("data") ?? process.env.TOMO_DATA_DIR ?? "./data");
const e = process.env;
let s: ObjectStore;
if (opt("local")) s = new LocalStore(resolve(opt("local")!));
else if (e.TOMO_S3_ENDPOINT && e.TOMO_S3_BUCKET && e.TOMO_S3_ACCESS_KEY_ID && e.TOMO_S3_SECRET_ACCESS_KEY)
  s = new S3Store({ endpoint: e.TOMO_S3_ENDPOINT, bucket: e.TOMO_S3_BUCKET, region: e.TOMO_S3_REGION ?? "auto", accessKeyId: e.TOMO_S3_ACCESS_KEY_ID, secretAccessKey: e.TOMO_S3_SECRET_ACCESS_KEY, prefix: e.TOMO_S3_PREFIX });
else s = die("Where are the backups? Set TOMO_S3_ENDPOINT, TOMO_S3_BUCKET, TOMO_S3_ACCESS_KEY_ID, TOMO_S3_SECRET_ACCESS_KEY (and TOMO_S3_PREFIX if you used one), or pass --local <folder>.");

const keys = (await s.list("backups/")).filter((k) => k.endsWith(".tomobk")).sort().reverse();
if (flag("list")) {
  console.log(keys.length ? keys.join("\n") : "No backups found.");
  process.exit(0);
}
const code = opt("code") ?? die("Pass --code <recovery code> (Settings → 备份).");
const key = opt("backup") ?? keys[0] ?? die("No backups found in this storage.");

if (existsSync(join(dataDir, "app.sqlite"))) {
  if (!flag("force")) die(`${dataDir} already holds a Tomo. Stop Tomo and add --force to replace it (the current folder is kept).`);
  const aside = `${dataDir}.before-restore-${Date.now()}`;
  renameSync(dataDir, aside);
  console.log(`Kept the current data as ${aside}`);
}
const got = (await s.get(key)) ?? die(`Backup ${key} not found.`);
const tgz = open(got.body, code);
mkdirSync(dataDir, { recursive: true });
await untarTo(dataDir, tgz);
console.log(`Restored ${key} into ${dataDir}. Start Tomo as usual.`);
