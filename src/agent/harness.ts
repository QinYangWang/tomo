import { createModels, type MutableModels } from "@earendil-works/pi-ai/models";
import { anthropicProvider } from "@earendil-works/pi-ai/providers/anthropic";
import { openaiProvider } from "@earendil-works/pi-ai/providers/openai";
import { googleProvider } from "@earendil-works/pi-ai/providers/google";
import { createRegistry, Harness } from "@earendil-works/pi-durable";
import { NodeExecutionEnv } from "@earendil-works/pi-durable/env/node";
import { CodingTools } from "@earendil-works/pi-durable/tools";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "../config.ts";
import { openBunSqliteStorage } from "../storage/bun-sqlite.ts";
import { loadPlugins, Plugins } from "./evolve/plugins.ts";
import { Delegate } from "./extensions/delegate.ts";
import { Memory } from "./extensions/memory.ts";
import { Persona } from "./extensions/persona.ts";
import { Projects } from "./extensions/projects.ts";
import { Scheduler } from "./extensions/scheduler.ts";
import { Skills } from "./extensions/skills.ts";
import { ctx } from "./util.ts";

export async function openAgent(opts: { models?: MutableModels } = {}) {
  const models = opts.models ?? createModels();
  if (!opts.models) {
    if (process.env.ANTHROPIC_API_KEY) models.setProvider(anthropicProvider());
    if (process.env.OPENAI_API_KEY) models.setProvider(openaiProvider());
    if (process.env.GEMINI_API_KEY) models.setProvider(googleProvider());
  }

  const registry = createRegistry();
  // Install order is prompt order: identity first, tools after.
  for (const ext of [Persona, Memory, Projects, Skills, Scheduler, Delegate, Plugins, CodingTools]) registry.install(ext);
  await loadPlugins(registry);

  const defaultCwd = join(config.dataDir, "workspace");
  mkdirSync(defaultCwd, { recursive: true });

  const harness = await Harness.open(
    await openBunSqliteStorage(config.harnessDb),
    {
      models,
      registry,
      // Each conversation's tools run in its project's directory (or the shared workspace).
      env: ({ cwd }: { cwd?: string }) => new NodeExecutionEnv({ cwd: cwd ?? defaultCwd }),
      settings: {
        compaction: { reserveTokens: 16_384, backgroundTokens: 32_768, keepRecentTokens: 20_000 },
        retry: { maxRetries: 3 },
        toolExecution: "parallel",
      },
      onReport: (e: unknown) => console.error("[harness]", e),
    } as any,
    ctx,
  );

  (harness as any).closed?.then((end: any) => {
    if (end.reason === "failed") {
      console.error("[harness] closed after failure, exiting for supervisor restart:", end.error);
      process.exit(1);
    }
  });

  // The owner's home conversation is the harness root: one continuous thread across every surface.
  const root = await harness.root(ctx, { agent: { model: config.model } });
  harness.resume(); // finish whatever the last process left mid-run

  return { harness, registry, models, root };
}

export type Agent = Awaited<ReturnType<typeof openAgent>>;
