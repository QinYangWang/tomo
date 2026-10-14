import { ChannelType, Client, Events, GatewayIntentBits, Partials, type Message, type TextBasedChannel } from "discord.js";
import { after, type ChannelAdapter, type ContextLine, type Inbound } from "../gateway/types.ts";

type Addr = { channelId: string };

/** Lines of context fetched when there is no cursor yet; Discord pages are at most 100. */
const FIRST = 20;

/** Reading context needs the Read Message History permission in the channel. */
export class DiscordAdapter implements ChannelAdapter {
  readonly platform = "discord";
  readonly maxLength = 1900;
  private client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages],
    partials: [Partials.Channel], // needed to receive DMs
  });

  constructor(private readonly token: string) {}

  async start(handle: (m: Inbound) => Promise<void>) {
    this.client.on(Events.MessageCreate, async (msg) => {
      if (msg.author.bot) return;
      const me = this.client.user!;
      const isDirect = msg.channel.type === ChannelType.DM;
      if (!isDirect && !msg.mentions.has(me)) return;
      const isThread = msg.channel.isThread();
      let replyTo: ContextLine | undefined;
      if (msg.reference?.messageId) {
        const ref = await msg.fetchReference().catch(() => undefined);
        if (ref && ref.author.id !== me.id) replyTo = this.line(ref);
      }
      void handle({
        platform: this.platform,
        messageId: msg.id,
        position: msg.id,
        userId: msg.author.id,
        userName: msg.member?.displayName ?? msg.author.globalName ?? msg.author.username,
        chatId: isThread ? (msg.channel as any).parentId : msg.channelId,
        threadId: isThread ? msg.channelId : undefined,
        isDirect,
        text: this.plain(msg),
        address: { channelId: msg.channelId } satisfies Addr,
        replyTo,
      });
    });
    await this.client.login(this.token);
    await new Promise<void>((r) => this.client.once(Events.ClientReady, () => r()));
  }

  async stop() {
    await this.client.destroy();
  }

  private async channel(a: Addr) {
    return (await this.client.channels.fetch(a.channelId)) as TextBasedChannel & { send: Function; sendTyping: Function };
  }

  async send(address: unknown, text: string) {
    await (await this.channel(address as Addr)).send(text);
  }

  async typing(address: unknown) {
    await (await this.channel(address as Addr)).sendTyping();
  }

  async context(m: Inbound, since?: string): Promise<ContextLine[]> {
    const ch: any = await this.client.channels.fetch((m.address as Addr).channelId);
    if (!ch?.messages) return [];
    const page = await ch.messages.fetch({ before: m.position, limit: since ? 100 : FIRST });
    const msgs: Message[] = [...page.values()].reverse(); // newest first from Discord
    // A thread's first message lives in the parent channel; include it the first time.
    if (!since && ch.isThread?.()) {
      const starter = await ch.fetchStarterMessage().catch(() => null);
      if (starter) msgs.unshift(starter);
    }
    const me = this.client.user!.id;
    return msgs.filter((x) => x.author.id !== me && (!since || after(x.id, since))).map((x) => this.line(x));
  }

  private line(x: Message): ContextLine {
    const files = [...x.attachments.values()].map((a) => `[file: ${a.name}]`).join(" ");
    return { id: x.id, user: x.member?.displayName ?? x.author.globalName ?? x.author.username, text: [this.plain(x), files].filter(Boolean).join(" ") };
  }

  /** Our own mention removed, other mentions as @name. */
  private plain(x: Message): string {
    const me = this.client.user!.id;
    let t = x.content.replace(new RegExp(`<@!?${me}>`, "g"), "");
    for (const u of x.mentions.users.values()) t = t.replace(new RegExp(`<@!?${u.id}>`, "g"), `@${u.globalName ?? u.username}`);
    return t.trim();
  }
}
