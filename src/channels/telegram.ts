import { Bot } from "grammy";
import type { ChannelAdapter, Inbound } from "../gateway/types.ts";

type Addr = { chatId: number; threadId?: number; replyTo?: number };

export class TelegramAdapter implements ChannelAdapter {
  readonly platform = "telegram";
  readonly maxLength = 4000;
  private bot: Bot;

  constructor(token: string) {
    this.bot = new Bot(token);
  }

  async start(handle: (m: Inbound) => Promise<void>) {
    const me = await this.bot.api.getMe();
    this.bot.on("message:text", (c) => {
      const msg = c.message;
      const isDirect = msg.chat.type === "private";
      // In groups, only answer when mentioned or replied to.
      const mentioned = msg.text.includes(`@${me.username}`) || msg.reply_to_message?.from?.id === me.id;
      if (!isDirect && !mentioned) return;
      const address: Addr = { chatId: msg.chat.id, threadId: msg.message_thread_id, replyTo: isDirect ? undefined : msg.message_id };
      void handle({
        platform: this.platform,
        messageId: String(msg.message_id),
        userId: String(msg.from.id),
        userName: msg.from.username ?? msg.from.first_name,
        chatId: String(msg.chat.id),
        threadId: msg.is_topic_message ? String(msg.message_thread_id) : undefined,
        isDirect,
        text: msg.text.replace(`@${me.username}`, "").trim(),
        address,
      });
    });
    this.bot.catch((e) => console.error("[telegram]", e.error));
    void this.bot.start({ drop_pending_updates: false });
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
