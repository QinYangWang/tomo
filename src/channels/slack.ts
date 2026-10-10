import { App } from "@slack/bolt";
import type { ChannelAdapter, Inbound } from "../gateway/types.ts";

type Addr = { channel: string; threadTs?: string };

/** Socket Mode: no public URL needed, which suits a VPS behind a firewall. */
export class SlackAdapter implements ChannelAdapter {
  readonly platform = "slack";
  readonly maxLength = 3500;
  private app: App;
  private botUserId = "";

  constructor(botToken: string, appToken: string) {
    this.app = new App({ token: botToken, appToken, socketMode: true });
  }

  async start(handle: (m: Inbound) => Promise<void>) {
    const auth = await this.app.client.auth.test();
    this.botUserId = auth.user_id as string;

    const forward = (e: any, isDirect: boolean) => {
      if (e.bot_id || e.subtype) return;
      // In channels, a reply inside a thread stays in that thread; a top-level mention starts one.
      const threadTs = e.thread_ts ?? (isDirect ? undefined : e.ts);
      void handle({
        platform: this.platform,
        messageId: e.client_msg_id ?? e.ts,
        userId: e.user,
        userName: e.user,
        chatId: e.channel,
        threadId: isDirect ? undefined : e.thread_ts, // top-level mention -> channel conversation
        isDirect,
        text: String(e.text ?? "").replace(new RegExp(`<@${this.botUserId}>`, "g"), "").trim(),
        address: { channel: e.channel, threadTs } satisfies Addr,
      });
    };

    this.app.event("app_mention", async ({ event }) => forward(event, false));
    this.app.message(async ({ message }) => {
      const m = message as any;
      if (m.channel_type === "im") forward(m, true);
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
}
