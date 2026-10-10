/**
 * Runtime settings, edited from the web UI instead of .env.
 *
 * Plain settings (default model, owners, which channels are on) live as JSON rows.
 * Secrets (provider API keys, bot tokens) are encrypted at rest with AES-256-GCM under a
 * key file generated on first start (data/secret.key, mode 0600), so a copied app.sqlite
 * alone does not leak them. The HTTP API never returns a secret, only whether it is set
 * and its last four characters.
 *
 * Environment variables still work as a fallback for headless setups; a value saved in
 * the UI wins over the environment.
 */
import type { CreateModelsOptions } from "@earendil-works/pi-ai/models";

type CredentialStore = NonNullable<CreateModelsOptions["credentials"]>;
type Credential = NonNullable<Awaited<ReturnType<CredentialStore["read"]>>>;
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "../config.ts";
import { db, now } from "./db.ts";

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS secrets  (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL);
`);

// ---------- encryption ----------

const keyPath = join(config.dataDir, "secret.key");
function masterKey(): Buffer {
  if (!existsSync(keyPath)) {
    writeFileSync(keyPath, randomBytes(32).toString("base64"), { mode: 0o600 });
  }
  try {
    chmodSync(keyPath, 0o600);
  } catch {}
  return Buffer.from(readFileSync(keyPath, "utf8").trim(), "base64");
}
const KEY = masterKey();

function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", KEY, iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64")).join(".");
}
function open(sealed: string): string {
  const [iv, tag, body] = sealed.split(".").map((s) => Buffer.from(s, "base64"));
  const d = createDecipheriv("aes-256-gcm", KEY, iv!);
  d.setAuthTag(tag!);
  return Buffer.concat([d.update(body!), d.final()]).toString("utf8");
}

// ---------- plain settings ----------

export const settings = {
  get<T>(key: string, fallback: T): T {
    const r = db.query("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | null;
    return r ? (JSON.parse(r.value) as T) : fallback;
  },
  set(key: string, value: unknown) {
    db.run("INSERT OR REPLACE INTO settings(key, value, updated_at) VALUES (?,?,?)", [key, JSON.stringify(value), now()]);
  },
  delete(key: string) {
    db.run("DELETE FROM settings WHERE key = ?", [key]);
  },
};

export const secrets = {
  get(key: string): string | undefined {
    const r = db.query("SELECT value FROM secrets WHERE key = ?").get(key) as { value: string } | null;
    if (!r) return undefined;
    try {
      return open(r.value);
    } catch {
      return undefined; // key file replaced: treat as unset
    }
  },
  set(key: string, value: string) {
    db.run("INSERT OR REPLACE INTO secrets(key, value, updated_at) VALUES (?,?,?)", [key, seal(value), now()]);
  },
  delete(key: string) {
    db.run("DELETE FROM secrets WHERE key = ?", [key]);
  },
  has(key: string) {
    return !!db.query("SELECT 1 FROM secrets WHERE key = ?").get(key);
  },
  /** Safe preview for the UI: never the secret itself. */
  preview(key: string): { set: boolean; last4?: string } {
    const v = this.get(key);
    return v ? { set: true, last4: v.slice(-4) } : { set: false };
  },
};

// ---------- runtime values (UI first, env second) ----------

export type ModelRef = { provider: string; modelId: string };

export const runtime = {
  model(): ModelRef {
    return settings.get<ModelRef>("model", config.model);
  },
  smallModel(): ModelRef {
    return settings.get<ModelRef>("smallModel", settings.get<ModelRef | null>("model", null) ? runtime.model() : config.smallModel);
  },
  owners(): string[] {
    return [...new Set([...config.owners, ...settings.get<string[]>("owners", [])])];
  },
  allowed(): string[] {
    return [...new Set([...config.allowed, ...settings.get<string[]>("allowed", [])])];
  },
  addOwner(id: string) {
    settings.set("owners", [...new Set([...settings.get<string[]>("owners", []), id])]);
  },
  removeOwner(id: string) {
    settings.set("owners", settings.get<string[]>("owners", []).filter((o) => o !== id));
  },
};

// ---------- owner profile (who the agent works for) ----------

export const PROFILE_FIELDS = ["name", "nickname", "birthday", "email", "phone", "home", "work", "household", "interests", "pets"] as const;
export type Profile = Partial<Record<(typeof PROFILE_FIELDS)[number], string>>;
export const profile = {
  get(): Profile {
    return settings.get<Profile>("profile", {});
  },
  /** Merges known fields only; an empty string clears a field. */
  update(patch: Record<string, unknown>): Profile {
    const cur = profile.get();
    for (const f of PROFILE_FIELDS) {
      const v = patch[f];
      if (typeof v !== "string") continue;
      const t = v.trim().slice(0, 300);
      if (t) cur[f] = t;
      else delete cur[f];
    }
    settings.set("profile", cur);
    return cur;
  },
};

// ---------- channels ----------

export const CHANNELS = {
  telegram: { fields: ["token"], env: { token: "TELEGRAM_BOT_TOKEN" } },
  discord: { fields: ["token"], env: { token: "DISCORD_BOT_TOKEN" } },
  slack: { fields: ["botToken", "appToken"], env: { botToken: "SLACK_BOT_TOKEN", appToken: "SLACK_APP_TOKEN" } },
} as const satisfies Record<string, { fields: readonly string[]; env: Record<string, string> }>;
export type ChannelId = keyof typeof CHANNELS;

export const channelSettings = {
  /** Token values for a channel: UI-saved first, env second. */
  values(id: ChannelId): Record<string, string | undefined> {
    const spec = CHANNELS[id];
    return Object.fromEntries(spec.fields.map((f) => [f, secrets.get(`channel:${id}:${f}`) ?? process.env[(spec.env as any)[f]]]));
  },
  enabled(id: ChannelId): boolean {
    const v = this.values(id);
    return settings.get<boolean>(`channel:${id}:enabled`, true) && CHANNELS[id].fields.every((f) => !!v[f]);
  },
};

// ---------- pi-ai credential store ----------

/** Provider API keys live in the encrypted secrets table; pi-ai reads them per request. */
export const credentialStore: CredentialStore = {
  async read(providerId) {
    const key = secrets.get(`provider:${providerId}`);
    return key ? { type: "api_key", key } : undefined;
  },
  async list() {
    const rows = db.query("SELECT key FROM secrets WHERE key LIKE 'provider:%'").all() as { key: string }[];
    return rows.map((r) => ({ providerId: r.key.slice("provider:".length), type: "api_key" as const }));
  },
  async modify(providerId, fn) {
    const next = await fn(await this.read(providerId));
    if (next?.type === "api_key" && next.key) secrets.set(`provider:${providerId}`, next.key);
    return next ?? (await this.read(providerId));
  },
  async delete(providerId) {
    secrets.delete(`provider:${providerId}`);
  },
};

// ---------- web auth ----------

const sha256 = (s: string) => new Bun.CryptoHasher("sha256").update(s).digest("hex");

export const auth = {
  hasPassword(): boolean {
    return secrets.has("admin:password");
  },
  async setPassword(password: string) {
    secrets.set("admin:password", await Bun.password.hash(password));
    db.run("DELETE FROM sessions"); // a new password signs every client out
  },
  async verify(password: string): Promise<boolean> {
    const hash = secrets.get("admin:password");
    return !!hash && (await Bun.password.verify(password, hash));
  },
  newSession(): string {
    const token = randomBytes(32).toString("base64url");
    db.run("INSERT INTO sessions(token_hash, created_at, last_seen) VALUES (?,?,?)", [sha256(token), now(), now()]);
    return token;
  },
  checkSession(token: string | undefined | null): boolean {
    if (!token) return false;
    if (config.http.token && token === config.http.token) return true; // headless override
    const h = sha256(token);
    const ok = !!db.query("SELECT 1 FROM sessions WHERE token_hash = ?").get(h);
    if (ok) db.run("UPDATE sessions SET last_seen = ? WHERE token_hash = ?", [now(), h]);
    return ok;
  },
  endSession(token: string) {
    db.run("DELETE FROM sessions WHERE token_hash = ?", [sha256(token)]);
  },
};

// ---------- pairing a messaging account as owner ----------

let pairing: { code: string; expires: number } | undefined;
export const pairingCodes = {
  issue(): { code: string; expires: number } {
    pairing = { code: String(100000 + Math.floor(Math.random() * 900000)), expires: Date.now() + 10 * 60_000 };
    return pairing;
  },
  /** One-time: a correct code is consumed. */
  redeem(code: string): boolean {
    if (!pairing || Date.now() > pairing.expires || code.trim() !== pairing.code) return false;
    pairing = undefined;
    return true;
  },
};
