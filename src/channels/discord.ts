import { ChannelType, Client, Events, GatewayIntentBits, Partials, type TextBasedChannel } from "discord.js";
import type { ChannelAdapter, Inbound } from "../gateway/types.ts";

type Addr = { channelId: string };

export class DiscordAdapter implements ChannelAdapter {
  readonly platform = "discord";
  readonly maxLength = 1900;
  private client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages],
    partials: [Partials.Channel], // needed to receive DMs
  });

  constructor(private readonly token: string) {}

  async start(handle: (m: Inbound) => Promise<void>) {
    this.client.on(Events.MessageCreate, (msg) => {
      if (msg.author.bot) return;
      const me = this.client.user!;
      const isDirect = msg.channel.type === ChannelType.DM;
      if (!isDirect && !msg.mentions.has(me)) return;
      const isThread = msg.channel.isThread();
      void handle({
        platform: this.platform,
        messageId: msg.id,
        userId: msg.author.id,
        userName: msg.author.username,
        chatId: isThread ? (msg.channel as any).parentId : msg.channelId,
        threadId: isThread ? msg.channelId : undefined,
        isDirect,
        text: msg.content.replace(new RegExp(`<@!?${me.id}>`, "g"), "").trim(),
        address: { channelId: msg.channelId } satisfies Addr,
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
}
