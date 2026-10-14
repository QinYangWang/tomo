import { Bot } from "grammy";
import { after, type ChannelAdapter, type ContextLine, type Inbound } from "../gateway/types.ts";

type Addr = { chatId: number; threadId?: number; replyTo?: number };

/** Messages kept per group chat (or topic) for context. */
const KEEP = 200;

/**
 * The Bot API can't read a chat's history, so the adapter keeps the recent messages it sees.
 * With privacy mode on (BotFather's default) Telegram only shows the bot commands, mentions and
 * replies; turn it off (/setprivacy → Disable) for full group context.
 */
export class TelegramAdapter implements ChannelAdapter {
  readonly platform = "telegram";
  readonly maxLength = 4000;
  private bot: Bot;
  private seen = new Map<string, ContextLine[]>();

  constructor(token: string) {
    this.bot = new Bot(token);
  }

  private static key(chatId: number | string, thread?: number | string) {
    return `${chatId}:${thread ?? ""}`;
  }

  private static who(from?: { username?: string; first_name?: string; last_name?: string }) {
    return from ? [from.first_name, from.last_name].filter(Boolean).join(" ") || from.username || "someone" : "someone";
  }

  async start(handle: (m: Inbound) => Promise<void>) {
    const me = await this.bot.api.getMe();
    this.bot.on("message", (c) => {
      const msg = c.message;
      const isDirect = msg.chat.type === "private";
      const body = msg.text ?? msg.caption ?? "";
      const thread = msg.is_topic_message ? msg.message_thread_id : undefined;
      const mentioned = body.includes(`@${me.username}`) || msg.reply_to_message?.from?.id === me.id;
      if (!isDirect && (!msg.text || !mentioned)) {
        this.remember(msg.chat.id, thread, msg);
        return;
      }
      if (!msg.text) return;
      const r = msg.reply_to_message;
      const address: Addr = { chatId: msg.chat.id, threadId: msg.message_thread_id, replyTo: isDirect ? undefined : msg.message_id };
      void handle({
        platform: this.platform,
        messageId: String(msg.message_id),
        position: String(msg.message_id),
        userId: String(msg.from.id),
        userName: TelegramAdapter.who(msg.from),
        chatId: String(msg.chat.id),
        threadId: thread !== undefined ? String(thread) : undefined,
        isDirect,
        text: msg.text.replace(`@${me.username}`, "").trim(),
        address,
        replyTo: r && r.from?.id !== me.id && !r.forum_topic_created ? { id: String(r.message_id), user: TelegramAdapter.who(r.from), text: r.text ?? r.caption ?? "" } : undefined,
      });
    });
    this.bot.catch((e) => console.error("[telegram]", e.error));
    void this.bot.start({ drop_pending_updates: false });
  }

  private remember(chatId: number, thread: number | undefined, msg: any) {
    const key = TelegramAdapter.key(chatId, thread);
    const list = this.seen.get(key) ?? [];
    const file = msg.document?.file_name ? ` [file: ${msg.document.file_name}]` : msg.photo ? " [photo]" : "";
    const text = `${msg.text ?? msg.caption ?? ""}${file}`.trim();
    if (!text) return;
    list.push({ id: String(msg.message_id), user: TelegramAdapter.who(msg.from), text });
    if (list.length > KEEP) list.splice(0, list.length - KEEP);
    this.seen.set(key, list);
  }

  async context(m: Inbound, since?: string): Promise<ContextLine[]> {
    const list = this.seen.get(TelegramAdapter.key(m.chatId, m.threadId)) ?? [];
    return list.filter((l) => after(m.position!, l.id) && (!since || after(l.id, since))).slice(since ? 0 : -20);
  }

  async stop() {
    await this.bot.stop();
  }

  async send(address: unknown, text: string) {
    const a = address as Addr;
    const opts = { message_thread_id: a.threadId, reply_parameters: a.replyTo ? { message_id: a.replyTo } : undefined };
    try {
      await this.bot.api.sendMessage(a.chatId, text, { ...opts, parse_mode: "Markdown" });
    } catch {
      await this.bot.api.sendMessage(a.chatId, text, opts); // unbalanced markdown: send plain
    }
  }

  async typing(address: unknown) {
    const a = address as Addr;
    await this.bot.api.sendChatAction(a.chatId, "typing", { message_thread_id: a.threadId });
  }
}
