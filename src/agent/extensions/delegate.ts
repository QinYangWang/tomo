/**
 * Subagents, history search, handoff, and web fetch: the general-purpose toolbelt.
 * Subagents follow Pi Durable's ownership pattern: the child conversation is owned by
 * the tool call, so it survives crashes and aborting the call aborts the child.
 */
import { Type } from "@earendil-works/pi-ai";
import { AssistantEntry, configure, defineExtension, defineTool, type Extension } from "@earendil-works/pi-durable";
import { config } from "../../config.ts";
import { messageText, roleOf, text } from "../util.ts";

export const Delegate: Extension = defineExtension({
  name: "delegate",
  tools: [
    defineTool({
      name: "delegate",
      description:
        "Hand a self-contained piece of work to a subagent (cheaper model, same tools, no further delegation) and get its answer. Use several in one turn for independent parallel research.",
      parameters: Type.Object({ task: Type.String({ description: "Everything the subagent needs: goal, facts, and the shape of the answer." }) }),
      replay: "safe",
      execute: async (args, api, context) => {
        const child = await api.commit(async (tx) => {
          const existing = (await tx.scanConversations({ ownerTaskId: api.taskId }, 1)).items[0];
          if (existing !== undefined) return existing.id;
          const created = await tx.createConversation({ ownership: { kind: "task", taskId: api.taskId } });
          await configure(tx, created.id, { model: config.smallModel, extensions: { remove: [Delegate] } });
          return created.id;
        }, context);
        await api.details({ conversationId: child }, context);
        const conv = await api.conversation(child, context);
        const settled = await (await conv!.submit({ type: "input", content: args.task, requestId: `delegate:${api.taskId}` }, context)).wait(context);
        if (settled.status !== "done" || settled.type !== "input" || !settled.answer) return text(`Subagent did not answer (${settled.status}).`, true);
        const entry = await api.commit((tx) => tx.entry(AssistantEntry, settled.answer!), context);
        return text(messageText(entry as any) || "(empty answer)");
      },
    }),

    defineTool({
      name: "search_history",
      description: "Search this conversation's full history, including messages before compaction or a handoff.",
      parameters: Type.Object({ text: Type.String(), limit: Type.Optional(Type.Number()) }),
      replay: "safe",
      execute: async (args, api, context) => {
        const needle = args.text.toLowerCase();
        const hits: string[] = [];
        let cursor: any = undefined;
        for (let page = 0; page < 50 && hits.length < (args.limit ?? 10); page++) {
          const res: any = await api.commit((tx) => tx.scanEntries({ conversationId: api.conversationId, order: "desc", after: cursor } as any, 200), context);
          for (const e of res.items) {
            const r = roleOf(e);
            if (r !== "user" && r !== "assistant") continue;
            const t = messageText(e);
            if (t.toLowerCase().includes(needle)) hits.push(`${r}: ${t.slice(0, 600)}`);
          }
          if (!res.next) break;
          cursor = res.next;
        }
        return text(hits.length ? hits.join("\n---\n") : "No matches.");
      },
    }),

    defineTool({
      name: "handoff",
      description: "Start a fresh context from a handoff note when the conversation has drifted far from the current task. Older messages stay searchable.",
      parameters: Type.Object({ note: Type.String() }),
      execute: async (args, api, context) => {
        const self = await api.conversation(api.conversationId, context);
        await self!.submit({ type: "input", content: "Continue.", requestId: `handoff:${api.taskId}` }, context);
        return { content: [{ type: "text" as const, text: "Handing off." }], control: { handoff: args.note } };
      },
    }),

    defineTool({
      name: "fetch_url",
      description: "Fetch a web page or API and return its text (HTML stripped).",
      parameters: Type.Object({ url: Type.String(), maxChars: Type.Optional(Type.Number()) }),
      replay: "safe",
      execute: async ({ url, maxChars }) => {
        const res = await fetch(url, { headers: { "user-agent": `${config.name}/0.1` }, signal: AbortSignal.timeout(20_000) });
        let body = await res.text();
        if ((res.headers.get("content-type") ?? "").includes("html")) {
          body = body
            .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/\s{2,}/g, " ");
        }
        return text(`HTTP ${res.status}\n${body.slice(0, maxChars ?? 20_000)}`, !res.ok);
      },
    }),
  ],
});
