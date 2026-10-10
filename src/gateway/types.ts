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
};

/** What a platform must implement. Adding a platform = one file implementing this. */
export interface ChannelAdapter {
  readonly platform: string;
  start(handle: (msg: Inbound) => Promise<void>): Promise<void>;
  stop(): Promise<void>;
  send(address: unknown, text: string): Promise<void>;
  /** Show "typing…" for a few seconds; called repeatedly while the agent works. */
  typing?(address: unknown): Promise<void>;
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
