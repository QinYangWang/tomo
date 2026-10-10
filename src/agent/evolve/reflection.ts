/**
 * The evolution loop. Every N answered turns, a background reflector reads the recent
 * transcript and (1) saves durable facts to memory, (2) fixes stale or contradicting
 * memories, (3) captures repeated procedures as skills or improves skills that misfired.
 *
 * The reflector is an ordinary durable conversation on the small model, so it survives
 * restarts; its requestId makes each reflection exactly-once.
 */
import type { Harness } from "@earendil-works/pi-durable";
import { db } from "../../app/db.ts";
import { formatMemories, memory } from "../../app/memory.ts";
import { projects } from "../../app/projects.ts";
import { config } from "../../config.ts";
import { ctx, MetaDoc, transcript } from "../util.ts";
import { Memory } from "../extensions/memory.ts";
import { Persona } from "../extensions/persona.ts";
import { Skills } from "../extensions/skills.ts";
import { bindings } from "../../gateway/bindings.ts";

const INSTRUCTIONS = `You are the reflection process of a personal agent. You never talk to the user.
You receive a slice of a conversation between the user and the agent. Improve the agent's long-term state:
1. remember durable facts about the user's world (who they are, people, places, preferences with their context, decisions and why). Keep the user's certainty: never broader or firmer than they said; mark your own conclusions confidence=inferred. Skip one-off task details, prices, availability, anything only true for a moment. Never save credentials, card numbers, or identity documents.
2. If a new fact contradicts an existing memory, update_memory instead of adding. If the user asked to forget something, forget every copy.
3. If the agent worked out a reusable procedure, or the user corrected how a task should be done, skill_save or skill_edit so next time is right.
4. Write less rather than more. If nothing is worth keeping, reply "nothing".
Finish with a one-line summary of what you changed.`;

let reflectorId: string | undefined;

async function reflector(harness: Harness) {
  if (reflectorId) return (await harness.conversation(reflectorId as any, ctx))!;
  const existing = bindings.get("system:reflector");
  if (existing) {
    reflectorId = existing;
    return (await harness.conversation(existing as any, ctx))!;
  }
  const conv = await harness.createConversation(
    {
      ownership: { kind: "ownerless" },
      agent: { model: config.smallModel, extensions: [Persona, Memory, Skills], instructions: INSTRUCTIONS },
    },
    ctx,
  );
  bindings.set("system:reflector", String(conv.id), "system");
  reflectorId = String(conv.id);
  return conv;
}

/** Count an answered turn; reflect when due. Fire-and-forget. */
export function noteTurn(harness: Harness, conversationId: string) {
  db.run(
    "INSERT INTO conversation_stats(conversation_id, turns) VALUES (?, 1) ON CONFLICT(conversation_id) DO UPDATE SET turns = turns + 1",
    [conversationId],
  );
  const s = db.query("SELECT turns, last_reflected FROM conversation_stats WHERE conversation_id = ?").get(conversationId) as {
    turns: number;
    last_reflected: number;
  };
  if (s.turns - s.last_reflected < config.reflectEvery) return;
  db.run("UPDATE conversation_stats SET last_reflected = ? WHERE conversation_id = ?", [s.turns, conversationId]);
  reflect(harness, conversationId, s.turns).catch((e) => console.error("[reflect]", e));
}

export async function reflect(harness: Harness, conversationId: string, turn: number) {
  const conv = await harness.conversation(conversationId as any, ctx);
  if (!conv) return;
  const view = await conv.viewState(ctx);
  const slice = transcript(view.value.entries, 16_000);
  view.dispose();
  if (!slice) return;

  const meta = await harness.snapshot(MetaDoc, conversationId as any, ctx);
  const project = meta?.projectId ? projects.get(meta.projectId) : undefined;
  const known = formatMemories(memory.recent({ scope: meta?.projectId, limit: 60 }));

  const r = await reflector(harness);
  await r.reset(undefined, ctx); // each reflection starts clean; old ones stay in storage
  const input = [
    project ? `Active project: ${project.name} (${project.id}). Current brief:\n${project.brief}` : "No active project.",
    `Existing memories:\n${known || "(none)"}`,
    `Conversation slice:\n${slice}`,
  ].join("\n\n");
  const sub = await r.submit({ type: "input", content: input, requestId: `reflect:${conversationId}:${turn}` }, ctx);
  const settled = await sub.wait(ctx);
  console.log(`[reflect] ${conversationId} turn ${turn}: ${settled.status}`);
}
