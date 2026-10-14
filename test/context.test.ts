/** Group chats: a mention arrives with the discussion since the agent last saw the chat, never twice. */
import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.TOMO_DATA_DIR ??= mkdtempSync(join(tmpdir(), "tomo-context-"));

test("context block keeps the newest lines and the reply", async () => {
  const { contextBlock, after } = await import("../src/gateway/types.ts");
  expect(after("1700000000.000200", "1700000000.000100")).toBe(true);
  expect(after("1234567890123456789", "1234567890123456788")).toBe(true);
  expect(after("9", "10")).toBe(false);
  const long = Array.from({ length: 40 }, (_, i) => ({ id: String(i + 1), user: "a", text: "x".repeat(500) + i }));
  const block = contextBlock(long);
  expect(block).toContain("x39");
  expect(block).not.toContain("x0\n");
  expect(block.length).toBeLessThan(8600);
  expect(contextBlock([], { id: "5", user: "bob", text: "ship it?" })).toBe("[Replying to bob] ship it?");
  expect(contextBlock([])).toBe("");
});

test("a mention in a group carries what was said since last time", async () => {
  const { createModels } = await import("@earendil-works/pi-ai/models");
  const { fauxProvider, fauxAssistantMessage, fauxText } = await import("@earendil-works/pi-ai/providers/faux");
  const { openAgent } = await import("../src/agent/harness.ts");
  const { Gateway } = await import("../src/gateway/gateway.ts");
  const { settings, runtime } = await import("../src/app/settings.ts");
  settings.set("model", { provider: "faux", modelId: "faux-1" });
  settings.set("smallModel", { provider: "faux", modelId: "faux-1" });
  settings.set("allowed", [...settings.get<string[]>("allowed", []), "grp:alice"]);
  expect(runtime.allowed()).toContain("grp:alice");

  const prompts: string[] = [];
  const faux = fauxProvider({ provider: "faux", models: [{ id: "faux-1", contextWindow: 200_000 }] });
  const reply = (context: any) => {
    prompts.push(JSON.stringify(context.messages.at(-1)));
    return fauxAssistantMessage([fauxText("ok")]);
  };
  faux.setResponses([reply, reply]);
  const models = createModels();
  models.setProvider(faux.provider);
  const agent = await openAgent({ models });
  const gw = new Gateway(agent);

  const chat = [
    { id: "1", user: "bob", text: "deploy failed again" },
    { id: "2", user: "carol", text: "the migration step timed out" },
  ];
  const sent: string[] = [];
  gw.register({
    platform: "grp",
    maxLength: 1000,
    start: async () => {},
    stop: async () => {},
    send: async (_a, t) => void sent.push(t),
    context: async (m, since) => chat.filter((l) => Number(l.id) < Number(m.position) && (!since || Number(l.id) > Number(since))),
  });

  const mention = (id: string, text: string) =>
    gw.handle({ platform: "grp", messageId: id, position: id, userId: "alice", userName: "alice", chatId: "c1", isDirect: false, text, address: {} });

  await mention("3", "what went wrong?");
  expect(prompts[0]).toContain("Earlier in this chat");
  expect(prompts[0]).toContain("carol: the migration step timed out");
  expect(prompts[0]).toContain("[alice on grp] what went wrong?");

  chat.push({ id: "4", user: "bob", text: "retried with a bigger timeout" });
  await mention("5", "and now?");
  expect(prompts[1]).toContain("bob: retried with a bigger timeout");
  expect(prompts[1]).not.toContain("deploy failed again");
  expect(sent).toEqual(["ok", "ok"]);
  await agent.harness.close((await import("../src/agent/util.ts")).ctx);
  // Test files share one process and settings; leave them as found.
  settings.delete("model");
  settings.delete("smallModel");
});
