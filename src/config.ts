/** All configuration comes from the environment (see .env.example). Bun loads .env on its own. */
import { resolve } from "node:path";

const env = (key: string, fallback?: string) => process.env[key] ?? fallback;
const list = (key: string) =>
  (process.env[key] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const dataDir = resolve(env("TOMO_DATA_DIR", "./data")!);

export const config = {
  name: env("TOMO_NAME", "Tomo")!,
  timezone: env("TOMO_TIMEZONE", "Asia/Taipei")!,
  dataDir,
  harnessDb: resolve(dataDir, "harness.sqlite"),
  appDb: resolve(dataDir, "app.sqlite"),
  projectsDir: resolve(dataDir, "projects"),
  skillsDir: resolve(dataDir, "skills"),
  pluginsDir: resolve(dataDir, "plugins"),

  model: {
    provider: env("TOMO_MODEL_PROVIDER", "anthropic")!,
    modelId: env("TOMO_MODEL_ID", "claude-sonnet-5-5")!,
  },
  /** Cheaper model for subagents and background reflection. */
  smallModel: {
    provider: env("TOMO_SMALL_MODEL_PROVIDER", env("TOMO_MODEL_PROVIDER", "anthropic"))!,
    modelId: env("TOMO_SMALL_MODEL_ID", "claude-haiku-5-5")!,
  },

  /** Reflect (extract memories, refine skills) every N answered turns of a conversation. */
  reflectEvery: Number(env("TOMO_REFLECT_EVERY", "6")),

  http: {
    port: Number(env("PORT", "8787")),
    /** Bearer token for the web/mobile clients and the HTTP API. */
    token: env("TOMO_API_TOKEN", ""),
  },

  telegram: { token: env("TELEGRAM_BOT_TOKEN") },
  discord: { token: env("DISCORD_BOT_TOKEN") },
  slack: {
    botToken: env("SLACK_BOT_TOKEN"),
    appToken: env("SLACK_APP_TOKEN"), // Socket Mode, so the VPS needs no public webhook
  },

  /**
   * Platform identities that belong to the owner, e.g. "telegram:12345,discord:6789,slack:U01ABC".
   * Owner DMs on every platform share one continuous conversation; anyone else is ignored
   * unless listed in TOMO_ALLOWED.
   */
  owners: list("TOMO_OWNERS"),
  allowed: list("TOMO_ALLOWED"),
};

export type Config = typeof config;
