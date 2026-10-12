/**
 * Automatic backups of everything that isn't already durable in object storage:
 * both SQLite databases (consistent snapshots via VACUUM INTO, safe while Tomo runs),
 * the encryption key file, skills and plugins, and the local repository store when no
 * S3 bucket is configured. Each backup is one sealed archive (archive.ts) under
 * backups/ in the same storage as project repositories. Daily at 04:00 local time, plus
 * once shortly after start when the last one is over a day old (for machines that sleep).
 * The newest KEEP backups are kept.
 *
 * Restore on any machine: `bun run src/restore.ts --code <recovery code>` (see that file).
 */
import { Database } from "bun:sqlite";
import { Cron } from "croner";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { secrets, settings } from "../app/settings.ts";
import { config } from "../config.ts";
import { store } from "../git/repos.ts";
import { newRecoveryCode, seal, tarDir } from "./archive.ts";

export const KEEP = 14;
const PREFIX = "backups/";
export type BackupInfo = { key: string; at: number };
export type LastBackup = { at: number; ok: boolean; key?: string; bytes?: number; error?: string; storage: "s3" | "local" };

/** The recovery code, created the first time anything needs it. */
export function recoveryCode(): string {
  let c = secrets.get("backup:code");
  if (!c) {
    c = newRecoveryCode();
    secrets.set("backup:code", c);
  }
  return c;
}

const stamp = (d = new Date()) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z"); // 20261012T040000Z
const parseStamp = (key: string) => {
  const m = /(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/.exec(key);
  return m ? Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +m[6]!) : 0;
};

export async function list(): Promise<BackupInfo[]> {
  return (await store().list(PREFIX))
    .filter((k) => k.endsWith(".tomobk"))
    .map((key) => ({ key, at: parseStamp(key) }))
    .sort((a, b) => b.at - a.at);
}

let running: Promise<LastBackup> | null = null;

/** Makes one backup now (joins one already running). Never throws; the result says what happened. */
export function backupNow(): Promise<LastBackup> {
  running ??= (async () => {
    const s = store();
    const tmp = join(config.dataDir, ".backup-tmp");
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(tmp, { recursive: true });
    try {
      const entries: string[] = [];
      for (const [file, name] of [[config.appDb, "app.sqlite"], [config.harnessDb, "harness.sqlite"]] as const) {
        if (!existsSync(file)) continue;
        const db = new Database(file, { readonly: true });
        try {
          db.run(`VACUUM INTO '${join(tmp, name).replace(/'/g, "''")}'`);
        } finally {
          db.close();
        }
        entries.push(name);
      }
      const copy = (rel: string) => {
        const src = join(config.dataDir, rel);
        if (!existsSync(src)) return;
        cpSync(src, join(tmp, rel), { recursive: true, filter: (p) => !p.includes(".tmp-") });
        entries.push(rel);
      };
      copy("secret.key");
      copy("skills");
      copy("plugins");
      if (s.kind === "local") copy("objects"); // repositories live only here without a bucket
      const sealed = seal(await tarDir(tmp, entries), recoveryCode());
      const key = `${PREFIX}${stamp()}.tomobk`;
      await s.put(key, sealed);
      for (const old of (await list()).slice(KEEP)) await s.delete(old.key);
      const last: LastBackup = { at: Date.now(), ok: true, key, bytes: sealed.length, storage: s.kind };
      settings.set("backup:last", last);
      return last;
    } catch (e) {
      const last: LastBackup = { at: Date.now(), ok: false, error: (e as Error).message.slice(0, 300), storage: s.kind };
      settings.set("backup:last", last);
      console.error("[backup]", e);
      return last;
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  })().finally(() => (running = null));
  return running;
}

export const backupSettings = {
  enabled: () => settings.get<boolean>("backup:enabled", true),
  setEnabled: (on: boolean) => settings.set("backup:enabled", on),
  last: () => settings.get<LastBackup | null>("backup:last", null),
};

/** Daily schedule. Returns a stop function. */
export function startBackups(): () => void {
  const job = new Cron("0 4 * * *", { timezone: config.timezone }, () => {
    if (backupSettings.enabled()) void backupNow();
  });
  // A machine that was asleep at 04:00 still gets its daily backup.
  const catchUp = setTimeout(() => {
    const last = backupSettings.last();
    if (backupSettings.enabled() && (!last?.ok || Date.now() - last.at > 26 * 3600_000)) void backupNow();
  }, 60_000);
  return () => {
    job.stop();
    clearTimeout(catchUp);
  };
}
