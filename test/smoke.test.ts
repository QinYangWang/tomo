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
  await again.harness.close(ctx);
});
