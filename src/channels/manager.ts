/**
 * Channels are connected from the settings page and can change while the process runs:
 * saving a token (re)starts that one adapter, switching it off stops it. Nothing restarts.
 */
import { CHANNELS, channelSettings, type ChannelId } from "../app/settings.ts";
import type { Gateway } from "../gateway/gateway.ts";
import type { ChannelAdapter } from "../gateway/types.ts";
import { DiscordAdapter } from "./discord.ts";
import { SlackAdapter } from "./slack.ts";
import { TelegramAdapter } from "./telegram.ts";

export type ChannelStatus = { state: "off" | "connecting" | "connected" | "error"; error?: string; at: number };
const status = new Map<ChannelId, ChannelStatus>();

function build(id: ChannelId): ChannelAdapter {
  const v = channelSettings.values(id);
  switch (id) {
    case "telegram":
      return new TelegramAdapter(v.token!);
    case "discord":
      return new DiscordAdapter(v.token!);
    case "slack":
      return new SlackAdapter(v.botToken!, v.appToken!);
  }
}

/** Bring one channel in line with its settings. Errors are recorded, never thrown. */
export async function syncChannel(gateway: Gateway, id: ChannelId): Promise<ChannelStatus> {
  await gateway.detach(id);
  if (!channelSettings.enabled(id)) {
    status.set(id, { state: "off", at: Date.now() });
    return status.get(id)!;
  }
  status.set(id, { state: "connecting", at: Date.now() });
  try {
    await withTimeout(gateway.attach(build(id)), 20_000);
    status.set(id, { state: "connected", at: Date.now() });
  } catch (e) {
    await gateway.detach(id);
    status.set(id, { state: "error", error: e instanceof Error ? e.message : String(e), at: Date.now() });
    console.error(`[${id}]`, e);
  }
  return status.get(id)!;
}

export async function syncAllChannels(gateway: Gateway) {
  await Promise.all((Object.keys(CHANNELS) as ChannelId[]).map((id) => syncChannel(gateway, id)));
}

export function channelStatus(id: ChannelId): ChannelStatus {
  return status.get(id) ?? { state: "off", at: 0 };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`no response after ${ms / 1000}s`)), ms))]);
}
