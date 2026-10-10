import { Type } from "@earendil-works/pi-ai";
import { defineExtension, defineTool, section } from "@earendil-works/pi-durable";
import { formatMemories, memory, type MemoryKind } from "../../app/memory.ts";
import { MetaDoc, text } from "../util.ts";

const Kind = Type.Union(
  ["profile", "preference", "person", "place", "fact", "decision", "episode"].map((k) => Type.Literal(k)),
  { description: "profile: who the user is. preference: how they like things (with its context). person/place: someone or somewhere in their life. fact: anything else durable. decision: what was decided and why. episode: a notable event." },
);

async function scopeOf(api: { snapshot: any; conversationId: any }, context: any): Promise<string | undefined> {
  const meta = await api.snapshot(MetaDoc, api.conversationId, context);
  return meta?.projectId;
}

const remember = defineTool({
  name: "remember",
  description:
    "Save one durable statement to long-term memory. Write it as a self-contained sentence with its conditions (place, people, occasion). Inside a project it goes to that project's own memory.",
  parameters: Type.Object({
    kind: Kind,
    subject: Type.String({ description: "Who or what it is about: 'user', a person's full name, a place, a project." }),
    content: Type.String(),
    confidence: Type.Optional(Type.Union([Type.Literal("stated"), Type.Literal("inferred")])),
  }),
  replay: "safe", // add() dedupes identical rows
  execute: async (args, api, context) => {
    const project = await scopeOf(api, context);
    const id = memory.add({
      kind: args.kind as MemoryKind,
      subject: args.subject,
      content: args.content,
      confidence: args.confidence,
      scope: project ?? "global",
      source: String(api.conversationId),
    });
    return text(`Saved memory #${id}.`);
  },
});

const recall = defineTool({
  name: "recall",
  description: "Search long-term memory. Query with names, topics, places. Returns matching memories with their ids.",
  parameters: Type.Object({ query: Type.String(), limit: Type.Optional(Type.Number()) }),
  replay: "safe",
  execute: async (args, api, context) => {
    const rows = memory.search(args.query, { scope: await scopeOf(api, context), limit: args.limit });
    return text(rows.length ? formatMemories(rows) : "No matching memories.");
  },
});

const updateMemory = defineTool({
  name: "update_memory",
  description: "Rewrite a memory that changed (e.g. a new address). Prefer this over adding a contradicting second memory.",
  parameters: Type.Object({ id: Type.Number(), content: Type.String(), confidence: Type.Optional(Type.Union([Type.Literal("stated"), Type.Literal("inferred")])) }),
  replay: "safe",
  execute: async (args) => {
    memory.update(args.id, args.content, args.confidence);
    return text(`Updated memory #${args.id}.`);
  },
});

const forget = defineTool({
  name: "forget",
  description: "Delete a memory. When the user asks you to forget something, recall every copy and forget each one.",
  parameters: Type.Object({ id: Type.Number() }),
  replay: "safe",
  execute: async (args) => {
    memory.forget(args.id);
    return text(`Forgot memory #${args.id}.`);
  },
});

export const Memory = defineExtension({
  name: "memory",
  tools: [remember, recall, updateMemory, forget],
  sections: [
    section("memory", async (input, context) => {
      const meta = await input.read.snapshot(MetaDoc, input.conversationId, context);
      const rows = memory.core(meta?.projectId);
      if (meta?.projectId) {
        if (!rows.length) return "This project's memory is empty. It is separate from the owner's chats: learn what this project needs as you go.";
        return `This project's memory (separate from the owner's chats):\n${formatMemories(rows)}\nSearch with recall.`;
      }
      if (!rows.length) return "Nothing saved about the user yet. Learn as you go.";
      return `What you know about the user (use quietly; do not recite it back):\n${formatMemories(rows)}\nSearch with recall for people, places, decisions and episodes.`;
    }),
  ],
});
