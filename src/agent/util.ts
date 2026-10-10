import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { defineDoc, type EntryRecord } from "@earendil-works/pi-durable";

export const ctx = BACKGROUND_CONTEXT;

/** Tool result with one text block. */
export const text = (t: string, isError = false) => ({ content: [{ type: "text" as const, text: t }], isError });

/**
 * Per-conversation application state, committed atomically with the transcript.
 * A fork starts with the parent's value, so a Slack thread inherits its channel's project.
 */
export type Meta = {
  projectId?: string;
  /** "home" for the owner's cross-platform conversation, "group", "thread", "system". */
  kind?: string;
  title?: string;
};
export const MetaDoc = defineDoc<Meta>({
  kind: "app.meta",
  version: 1,
  scope: "conversation",
  history: "latest",
  fork: "current",
  initial: () => ({}),
});

/** Plain text of a message list (user or assistant). */
export function messageText(entry: EntryRecord | undefined): string {
  if (!entry?.model) return "";
  const parts: string[] = [];
  for (const m of entry.model as any[]) {
    const content = m.content;
    if (typeof content === "string") parts.push(content);
    else if (Array.isArray(content)) for (const c of content) if (c?.type === "text") parts.push(c.text);
  }
  return parts.join("").trim();
}

export function roleOf(entry: EntryRecord): "user" | "assistant" | "tool" | "other" {
  if (entry.kind === "pi.user") return "user";
  if (entry.kind === "pi.assistant") return "assistant";
  if (entry.kind === "pi.tool-result") return "tool";
  return "other";
}

/** A compact transcript for reflection and search: user and assistant text only. */
export function transcript(entries: readonly EntryRecord[], maxChars = 24_000): string {
  const lines: string[] = [];
  for (const e of entries) {
    const r = roleOf(e);
    if (r !== "user" && r !== "assistant") continue;
    const t = messageText(e);
    if (t) lines.push(`${r.toUpperCase()}: ${t}`);
  }
  let out = lines.join("\n\n");
  if (out.length > maxChars) out = "…" + out.slice(-maxChars);
  return out;
}
