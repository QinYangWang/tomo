/**
 * Backups: a sealed snapshot lands in storage, restore.ts brings it back on a "new machine"
 * (an empty folder) with the recovery code, and a wrong code opens nothing.
 */
import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

process.env.TOMO_DATA_DIR ??= mkdtempSync(join(tmpdir(), "tomo-bk-"));
process.env.NO_PROXY = process.env.no_proxy = "127.0.0.1,localhost";

const { config } = await import("../src/config.ts");
const { settings } = await import("../src/app/settings.ts");
const repos = await import("../src/git/repos.ts");
const { backupNow, list, recoveryCode } = await import("../src/backup/backup.ts");
const RESTORE = resolve(import.meta.dir, "../src/restore.ts");

const restore = (args: string[], env: Record<string, string> = {}) => {
  const p = Bun.spawnSync([process.execPath, RESTORE, ...args], { env: { ...process.env, ...env, TOMO_DATA_DIR: "" } });
  return { code: p.exitCode, out: p.stdout.toString() + p.stderr.toString() };
};
const marker = (dir: string) => {
  const db = new Database(join(dir, "app.sqlite"), { readonly: true });
  const r = db.query("SELECT value FROM settings WHERE key = 'test:marker'").get() as { value: string } | null;
  db.close();
  return r ? JSON.parse(r.value) : null;
};

test("backup to local storage, restore into an empty folder", async () => {
  settings.set("test:marker", "local-1");
  mkdirSync(join(config.skillsDir, "tea"), { recursive: true });
  writeFileSync(join(config.skillsDir, "tea", "SKILL.md"), "# brew tea\n");
  const r = await backupNow();
  expect(r.ok).toBe(true);
  expect((await list()).length).toBeGreaterThan(0);

  const fresh = join(mkdtempSync(join(tmpdir(), "restore-")), "data");
  const local = join(config.dataDir, "objects");
  expect(restore(["--local", local, "--data", fresh, "--code", "WRONG-CODE"]).code).not.toBe(0);
  const ok = restore(["--local", local, "--data", fresh, "--code", recoveryCode().toLowerCase().replace(/-/g, " ")]);
  expect(ok.code).toBe(0);
  expect(marker(fresh)).toBe("local-1");
  expect(readFileSync(join(fresh, "secret.key"), "utf8")).toBe(readFileSync(join(config.dataDir, "secret.key"), "utf8"));
  expect(readFileSync(join(fresh, "skills", "tea", "SKILL.md"), "utf8")).toBe("# brew tea\n");
  // An existing Tomo is never overwritten without --force.
  expect(restore(["--local", local, "--data", fresh, "--code", recoveryCode()]).code).not.toBe(0);
  expect(restore(["--local", local, "--data", fresh, "--code", recoveryCode(), "--force"]).code).toBe(0);
}, 60_000);

const S3 = process.env.TOMO_TEST_S3;
test.skipIf(!S3)("backup to S3, restore from env-configured storage", async () => {
  await fetch(`${S3}/tomo-test`, { method: "PUT" }).catch(() => {});
  const prefix = `bk${Date.now().toString(36)}`;
  await repos.setStorage({ endpoint: S3!, bucket: "tomo-test", region: "us-east-1", accessKeyId: "test", secretAccessKey: "test", prefix });
  settings.set("test:marker", "s3-1");
  const r = await backupNow();
  expect(r.ok).toBe(true);
  expect(r.storage).toBe("s3");
  const env = { TOMO_S3_ENDPOINT: S3!, TOMO_S3_BUCKET: "tomo-test", TOMO_S3_REGION: "us-east-1", TOMO_S3_ACCESS_KEY_ID: "test", TOMO_S3_SECRET_ACCESS_KEY: "test", TOMO_S3_PREFIX: prefix };
  expect(restore(["--list"], env).out).toContain(".tomobk");
  const fresh = join(mkdtempSync(join(tmpdir(), "restore-")), "data");
  expect(restore(["--data", fresh, "--code", recoveryCode()], env).code).toBe(0);
  expect(marker(fresh)).toBe("s3-1");
  await repos.setStorage(null);
}, 60_000);
