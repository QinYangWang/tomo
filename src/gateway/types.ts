/** One message from any platform, normalized. */
export type Inbound = {
  platform: string; // "telegram" | "discord" | "slack" | "web" | ...
  messageId: string; // platform-unique, used as the exactly-once requestId
  userId: string;
  userName: string;
  chatId: string;
  threadId?: string; // Slack thread_ts, Discord thread id, Telegram topic id
  isDirect: boolean;
  text: string;
  /** First-party clients address a conversation directly. */
  conversationId?: string;
  /** Opaque to the gateway: the adapter's own reply address. */
  address: unknown;
  /** Where this message sits in its chat (see ContextLine.id); lets the gateway remember what it has seen. */
  position?: string;
  /** The message this one replies to, when the platform says so. */
  replyTo?: ContextLine;
};

/** One earlier message in a group chat, as context for the agent. */
export type ContextLine = {
  /** Platform position, comparable within one chat: Slack ts, Discord snowflake, Telegram message id. */
  id: string;
  user: string;
  text: string;
};

/** What a platform must implement. Adding a platform = one file implementing this. */
export interface ChannelAdapter {
  readonly platform: string;
  start(handle: (msg: Inbound) => Promise<void>): Promise<void>;
  stop(): Promise<void>;
  send(address: unknown, text: string): Promise<void>;
  /** Show "typing…" for a few seconds; called repeatedly while the agent works. */
  typing?(address: unknown): Promise<void>;
  /**
   * Group chats only: what was said before `m`, oldest first, and only after `after` when given
   * (the last message the agent already saw here). Never the bot's own messages.
   */
  context?(m: Inbound, after?: string): Promise<ContextLine[]>;
  /** Max characters per message, for chunking. */
  readonly maxLength: number;
}

export function chunk(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n\n", max);
    if (cut < max * 0.5) cut = rest.lastIndexOf("\n", max);
    if (cut < max * 0.5) cut = rest.lastIndexOf(" ", max);
    if (cut < max * 0.5) cut = max;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) out.push(rest);
  return out;
}

/** Positions are numbers in every platform we support; compare them without losing precision. */
export function after(a: string, b: string): boolean {
  if (/^\d+$/.test(a) && /^\d+$/.test(b)) return BigInt(a) > BigInt(b);
  return Number(a) > Number(b);
}

const LINE_MAX = 600;
const TOTAL_MAX = 8000;

/** The context block put before a group message: newest lines win when it runs long. */
export function contextBlock(lines: ContextLine[], replyTo?: ContextLine): string {
  const out: string[] = [];
  let size = 0;
  for (const l of [...lines].reverse()) {
    const t = l.text.replace(/\s+/g, " ").trim();
    if (!t) continue;
    const line = `${l.user}: ${t.length > LINE_MAX ? `${t.slice(0, LINE_MAX)}…` : t}`;
    if (size + line.length > TOTAL_MAX) break;
    out.unshift(line);
    size += line.length;
  }
  const parts: string[] = [];
  if (out.length) parts.push(`[Earlier in this chat, since you last saw it]\n${out.join("\n")}`);
  if (replyTo && !lines.some((l) => l.id === replyTo.id)) parts.push(`[Replying to ${replyTo.user}] ${replyTo.text.slice(0, LINE_MAX)}`);
  return parts.join("\n\n");
}
