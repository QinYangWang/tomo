import { App } from "@slack/bolt";
import { after, type ChannelAdapter, type ContextLine, type Inbound } from "../gateway/types.ts";

type Addr = { channel: string; threadTs?: string };

/** Lines of context fetched when there is no cursor yet. */
const FIRST_CHANNEL = 20;
const FIRST_THREAD = 100;

/**
 * Socket Mode: no public URL needed, which suits a VPS behind a firewall.
 * Reading context needs the channels:history, groups:history and users:read scopes; without them
 * the agent still answers, it just sees only the message it was tagged in.
 */
export class SlackAdapter implements ChannelAdapter {
  readonly platform = "slack";
  readonly maxLength = 3500;
  private app: App;
  private botUserId = "";
  private botId = "";
  private names = new Map<string, string>();

  constructor(botToken: string, appToken: string) {
    // Deferred so a bad token surfaces as an error from start(), not an unhandled rejection.
    this.app = new App({ token: botToken, appToken, socketMode: true, deferInitialization: true });
  }

  async start(handle: (m: Inbound) => Promise<void>) {
    await this.app.init();
    const auth = await this.app.client.auth.test();
    this.botUserId = auth.user_id as string;
    this.botId = (auth.bot_id as string) ?? "";

    console.log(`[slack] connected as @${auth.user} (${this.botUserId}) in ${auth.team}`);
    const forward = async (e: any, isDirect: boolean) => {
      console.log(`[slack] ${isDirect ? "dm" : "mention"} from ${e.user} in ${e.channel}${e.subtype ? ` (subtype ${e.subtype}, skipped)` : ""}`);
      if (e.bot_id || e.subtype) return;
      // In channels, a reply inside a thread stays in that thread; a top-level mention starts one.
      const threadTs = e.thread_ts ?? (isDirect ? undefined : e.ts);
      void handle({
        platform: this.platform,
        messageId: e.client_msg_id ?? e.ts,
        position: e.ts,
        userId: e.user,
        userName: await this.name(e.user),
        chatId: e.channel,
        threadId: isDirect ? undefined : e.thread_ts, // top-level mention -> channel conversation
        isDirect,
        text: await this.plain(String(e.text ?? "")),
        address: { channel: e.channel, threadTs } satisfies Addr,
      });
    };

    this.app.event("app_mention", async ({ event }) => forward(event, false));
    this.app.message(async ({ message }) => {
      const m = message as any;
      if (m.channel_type === "im") await forward(m, true);
    });
    await this.app.start();
  }

  async stop() {
    await this.app.stop();
  }

  async send(address: unknown, text: string) {
    const a = address as Addr;
    await this.app.client.chat.postMessage({ channel: a.channel, thread_ts: a.threadTs, text, mrkdwn: true });
  }

  async context(m: Inbound, since?: string): Promise<ContextLine[]> {
    const c = this.app.client;
    const before = m.position!;
    let raw: any[];
    if (m.threadId) {
      const res = await c.conversations.replies({ channel: m.chatId, ts: m.threadId, limit: FIRST_THREAD, ...(since ? { oldest: since } : {}) });
      raw = res.messages ?? [];
    } else {
      const res = await c.conversations.history({ channel: m.chatId, latest: before, inclusive: false, limit: since ? 100 : FIRST_CHANNEL, ...(since ? { oldest: since } : {}) });
      raw = (res.messages ?? []).reverse(); // newest first from Slack
    }
    const lines: ContextLine[] = [];
    for (const x of raw) {
      if (!x.ts || !after(before, x.ts)) continue;
      if (x.user === this.botUserId || (this.botId && x.bot_id === this.botId)) continue;
      if (x.subtype && x.subtype !== "thread_broadcast" && x.subtype !== "file_share") continue;
      const files = (x.files ?? []).map((f: any) => `[file: ${f.name ?? f.title ?? "attachment"}]`).join(" ");
      const text = [await this.plain(String(x.text ?? "")), files].filter(Boolean).join(" ");
      lines.push({ id: x.ts, user: x.user ? await this.name(x.user) : (x.username ?? "bot"), text });
    }
    return lines;
  }

  /** Display name for a user id, cached; the id itself when users:read is missing. */
  private async name(id: string): Promise<string> {
    const hit = this.names.get(id);
    if (hit) return hit;
    let name = id;
    try {
      const u: any = (await this.app.client.users.info({ user: id })).user;
      name = u?.profile?.display_name || u?.real_name || u?.name || id;
    } catch {}
    this.names.set(id, name);
    return name;
  }

  /** Slack markup to plain text: our own mention removed, other mentions as @name. */
  private async plain(text: string): Promise<string> {
    let out = text.replace(new RegExp(`<@${this.botUserId}>`, "g"), "");
    for (const [tag, id] of [...out.matchAll(/<@([UW][A-Z0-9]+)(?:\|[^>]*)?>/g)].map((x) => [x[0], x[1]!] as const)) out = out.replace(tag, `@${await this.name(id)}`);
    return out
      .replace(/<#[A-Z0-9]+\|([^>]+)>/g, "#$1")
      .replace(/<(https?:[^|>]+)\|([^>]+)>/g, "$2 ($1)")
      .replace(/<(https?:[^>]+)>/g, "$1")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
      .trim();
  }
}
