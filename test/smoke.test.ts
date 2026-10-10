/**
 * End-to-end smoke test on the faux model provider: a tool-using turn writes memory,
 * the answer comes back through the gateway, and a reopened process sees the same state.
 */
import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "tomo-"));
process.env.TOMO_DATA_DIR = dir;
process.env.TOMO_MODEL_PROVIDER = "faux";
process.env.TOMO_MODEL_ID = "faux-1";
process.env.TOMO_SMALL_MODEL_PROVIDER = "faux";
process.env.TOMO_SMALL_MODEL_ID = "faux-1";
process.env.TOMO_OWNERS = "test:owner";

test("turn, memory, delivery, restart", async () => {
  const { createModels } = await import("@earendil-works/pi-ai/models");
  const { fauxProvider, fauxAssistantMessage, fauxToolCall, fauxText } = await import("@earendil-works/pi-ai/providers/faux");
  const { openAgent } = await import("../src/agent/harness.ts");
  const { Gateway } = await import("../src/gateway/gateway.ts");
  const { memory } = await import("../src/app/memory.ts");
  const { ctx } = await import("../src/agent/util.ts");
  // Test files share one process (and the first one's config), so pin what this test needs.
  const { settings, runtime } = await import("../src/app/settings.ts");
  settings.set("model", { provider: "faux", modelId: "faux-1" });
  settings.set("smallModel", { provider: "faux", modelId: "faux-1" });
  runtime.addOwner("test:owner");

  const faux = fauxProvider({ provider: "faux", models: [{ id: "faux-1", contextWindow: 200_000 }] });
  faux.setResponses([
    fauxAssistantMessage([fauxToolCall("remember", { kind: "preference", subject: "user", content: "Prefers window seats on flights" })], { stopReason: "toolUse" } as any),
    fauxAssistantMessage([fauxText("Noted: window seats.")]),
  ]);
  const models = createModels();
  models.setProvider(faux.provider);

  const agent = await openAgent({ models });
  const gw = new Gateway(agent);
  const sent: string[] = [];
  gw.register({
    platform: "test",
    maxLength: 1000,
    start: async () => {},
    stop: async () => {},
    send: async (_a, t) => void sent.push(t),
  });

  await gw.handle({ platform: "test", messageId: "1", userId: "owner", userName: "me", chatId: "dm", isDirect: true, text: "I always want a window seat", address: {} });
  expect(sent).toEqual(["Noted: window seats."]);
  expect(memory.search("window").length).toBe(1);

  const rootId = String(agent.root.id);
  await agent.harness.close(ctx);

  const again = await openAgent({ models });
  expect(String(again.root.id)).toBe(rootId);
  const view = await again.root.viewState(ctx);
  expect(view.value.entries.filter((e) => e.kind === "pi.user").length).toBe(1);
  view.dispose();

  // Transcript search finds the earlier turn.
  const gw2 = new Gateway(again);
  const hits = await gw2.searchHistory(rootId, "window seat");
  expect(hits.map((h) => h.role)).toContain("user");

  // A Home panel: the agent is asked in the background panel conversation and publishes the card.
  const { panels } = await import("../src/app/panels.ts");
  const p = panels.create("BTC price");
  faux.setResponses([
    (context: any) => {
      const prompt = JSON.stringify(context.messages.at(-1));
      const id = prompt.match(/Home panel (\w+)/)![1]!;
      return fauxAssistantMessage([fauxToolCall("panel_publish", { id, title: "BTC", body: "# $97,000", cadence: "hourly" })], { stopReason: "toolUse" } as any);
    },
    fauxAssistantMessage([fauxText("Published.")]),
  ]);
  await gw2.buildPanel(p, "create");
  const built = panels.get(p.id)!;
  expect(built.status).toBe("live");
  expect(built.body).toBe("# $97,000");
  expect(built.next_refresh).toBeGreaterThan(Date.now());

  // Projects are isolated: their own fresh conversation and their own memory space.
  const { projects } = await import("../src/app/projects.ts");
  const proj = projects.create("Tokyo trip");
  const projConv = await gw2.projectConversation(proj.id);
  expect(projConv).not.toBe(rootId);
  expect(await gw2.projectConversation(proj.id)).toBe(projConv);
  const pv = await (await again.harness.conversation(Number(projConv) as any, ctx))!.viewState(ctx);
  expect(pv.value.entries.filter((e) => e.kind === "pi.user").length).toBe(0);
  pv.dispose();
  memory.add({ kind: "fact", subject: "Tokyo trip", content: "Hotel near Shibuya station", scope: proj.id });
  expect(memory.search("Shibuya").length).toBe(0);
  expect(memory.search("Shibuya", { scope: proj.id }).length).toBe(1);
  expect(memory.search("window", { scope: proj.id }).length).toBe(0);
  await again.harness.close(ctx);
});
