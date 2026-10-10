/**
 * Self-extension. The agent can write new tools for itself as Pi Durable extensions.
 *
 * Proposals land in data/plugins/pending/ and do nothing until the owner approves them
 * (/plugins, /approve <name>), because a plugin is code that runs with the agent's rights.
 * Approved plugins live in data/plugins/ and are hot-loaded: Pi Durable's registry swaps an
 * extension in place, running calls finish on the old code, the next call uses the new one.
 */
import { Type } from "@earendil-works/pi-ai";
import { defineExtension, defineTool, type Extension, type Registry } from "@earendil-works/pi-durable";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, watch, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "../../config.ts";
import { text } from "../util.ts";

const pendingDir = join(config.pluginsDir, "pending");
mkdirSync(pendingDir, { recursive: true });
const NAME = /^[a-z0-9][a-z0-9-]{1,47}$/;

export const PLUGIN_TEMPLATE = `// A plugin default-exports one Pi Durable extension.
import { Type } from "@earendil-works/pi-ai";
import { defineExtension, defineTool } from "@earendil-works/pi-durable";
export default defineExtension({
  name: "plugin-<name>",
  tools: [defineTool({
    name: "<tool_name>",
    description: "...",
    parameters: Type.Object({ /* ... */ }),
    replay: "safe", // only if rerunning after a crash is harmless
    execute: async (args, api, context) => ({ content: [{ type: "text", text: "..." }] }),
  })],
});`;

const loaded = new Map<string, Extension>();

async function load(registry: Registry, file: string) {
  const name = file.replace(/\.ts$/, "");
  try {
    const mod = await import(`${join(config.pluginsDir, file)}?v=${Date.now()}`);
    const ext = mod.default as Extension;
    if (!ext?.name) throw new Error("plugin must default-export an extension");
    registry.install(ext);
    loaded.set(name, ext);
    console.log(`[plugins] loaded ${name}`);
  } catch (e) {
    console.error(`[plugins] failed to load ${name}:`, e);
  }
}

export async function loadPlugins(registry: Registry) {
  for (const f of readdirSync(config.pluginsDir)) if (f.endsWith(".ts")) await load(registry, f);
  let timer: Timer | undefined;
  watch(config.pluginsDir, (_event, f) => {
    if (!f?.endsWith(".ts")) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (existsSync(join(config.pluginsDir, f))) load(registry, f);
      else {
        const ext = loaded.get(f.replace(/\.ts$/, ""));
        if (ext) registry.uninstall(ext);
      }
    }, 300);
  });
}

export const pluginAdmin = {
  pending: () => readdirSync(pendingDir).filter((f) => f.endsWith(".ts")).map((f) => f.replace(/\.ts$/, "")),
  active: () => [...loaded.keys()],
  show: (name: string) => (existsSync(join(pendingDir, `${name}.ts`)) ? readFileSync(join(pendingDir, `${name}.ts`), "utf8") : undefined),
  approve(name: string) {
    const from = join(pendingDir, `${name}.ts`);
    if (!existsSync(from)) return false;
    renameSync(from, join(config.pluginsDir, `${name}.ts`)); // the watcher loads it
    return true;
  },
  reject(name: string) {
    const from = join(pendingDir, `${name}.ts`);
    if (!existsSync(from)) return false;
    renameSync(from, join(pendingDir, `${name}.rejected`));
    return true;
  },
};

export const Plugins = defineExtension({
  name: "plugins",
  tools: [
    defineTool({
      name: "plugin_propose",
      description: `Propose a new tool for yourself as TypeScript code, when a capability is missing and a skill (instructions) is not enough. The owner reviews it and approves with /approve <name>; until then it does nothing. Template:\n${PLUGIN_TEMPLATE}`,
      parameters: Type.Object({ name: Type.String({ description: "kebab-case" }), code: Type.String(), rationale: Type.String() }),
      replay: "safe",
      execute: async ({ name, code, rationale }) => {
        if (!NAME.test(name)) return text("Name must be kebab-case.", true);
        writeFileSync(join(pendingDir, `${name}.ts`), `// Rationale: ${rationale.replace(/\n/g, " ")}\n${code}\n`);
        return text(`Proposed plugin "${name}". Tell the owner what it does and that /approve ${name} activates it.`);
      },
    }),
  ],
});
