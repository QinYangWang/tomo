/**
 * Backup archives: a tar.gz of the data folder, sealed with AES-256-GCM under a key derived
 * (scrypt) from the owner's recovery code. The bucket alone can't open a backup; the
 * recovery code alone has nothing to open. No database access here: restore.ts uses this
 * module on a fresh machine before any Tomo state exists.
 *
 * File layout: "TOMOBK1\n" | salt(16) | iv(12) | tag(16) | ciphertext
 */
import { spawn } from "node:child_process";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const MAGIC = Buffer.from("TOMOBK1\n");
const kdf = (code: string, salt: Buffer) => scryptSync(normalizeCode(code), salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });

/** Codes are shown grouped (ABCD-EFGH-...); spacing, dashes and case don't matter when typed back. */
export const normalizeCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");
export function newRecoveryCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I
  const raw = [...randomBytes(24)].map((b) => alphabet[b % alphabet.length]).join("");
  return raw.match(/.{4}/g)!.join("-");
}

export function seal(plain: Uint8Array, code: string): Buffer {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", kdf(code, salt), iv);
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([MAGIC, salt, iv, c.getAuthTag(), body]);
}

export function open(sealed: Uint8Array, code: string): Buffer {
  const b = Buffer.from(sealed);
  if (!b.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("not a Tomo backup");
  let o = MAGIC.length;
  const salt = b.subarray(o, (o += 16));
  const iv = b.subarray(o, (o += 12));
  const tag = b.subarray(o, (o += 16));
  const d = createDecipheriv("aes-256-gcm", kdf(code, salt), iv);
  d.setAuthTag(tag);
  try {
    return Buffer.concat([d.update(b.subarray(o)), d.final()]);
  } catch {
    throw new Error("wrong recovery code (or the backup is damaged)");
  }
}

function run(cmd: string, args: string[], input?: Uint8Array): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    const out: Buffer[] = [];
    let err = "";
    p.stdout.on("data", (d: Buffer) => out.push(d));
    p.stderr.on("data", (d: Buffer) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`${cmd} failed: ${err.trim().slice(0, 300)}`))));
    p.stdin.on("error", () => {});
    p.stdin.end(input ?? "");
  });
}

/** tar.gz of `entries` (paths relative to `dir`). */
export const tarDir = (dir: string, entries: string[]) => run("tar", ["-czf", "-", "-C", dir, "--", ...entries]);
export const untarTo = (dir: string, tgz: Uint8Array) => run("tar", ["-xzf", "-", "-C", dir], tgz);
