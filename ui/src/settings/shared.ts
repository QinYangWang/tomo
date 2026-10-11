import { api, enc } from "../api.ts";
import type { IconName } from "../icons.tsx";
import type { Channel, Provider } from "../types.ts";

export const CH: Record<Channel["id"], { label: string; fields: Record<string, string>; steps: string[] }> = {
  telegram: { label: "Telegram", fields: { token: "Bot Token" }, steps: ["Telegram 里找 @BotFather，发送 /newbot", "按提示起名，把它给的 token 填到这里"] },
  discord: { label: "Discord", fields: { token: "Bot Token" }, steps: ["Discord Developer Portal → New Application → Bot → Reset Token", "同一页打开 Message Content Intent", "OAuth2 → URL Generator 勾 bot，用生成的链接把机器人拉进服务器"] },
  slack: { label: "Slack", fields: { botToken: "Bot Token（xoxb-）", appToken: "App Token（xapp-）" }, steps: ["api.slack.com/apps → Create New App", "打开 Socket Mode，生成 App Token，scope 选 connections:write", "OAuth & Permissions 加 Bot scopes：app_mentions:read chat:write im:history im:read im:write", "Event Subscriptions 订阅 app_mention、message.im；App Home 里允许发消息", "Install to Workspace，复制 Bot Token"] },
};
export const STATE: Record<string, [string, string]> = { connected: ["已连接", "ok"], connecting: ["连接中", "warn"], error: ["连接失败", "err"], off: ["未连接", ""] };
export const dotCls = (s: string) => STATE[s]?.[1] ?? "";
export const ready = (p: Provider) => p.key.set || p.fromEnv;
export const chHasToken = (c: Channel) => Object.keys(CH[c.id].fields).every((f) => c.fields[f]?.last4 || c.fields[f]?.fromEnv);
export const chState = (c: Channel): [string, string] => (!chHasToken(c) ? ["未设置", ""] : !c.enabled ? ["已关闭", ""] : STATE[c.status.state] ?? ["", ""]);

export const PAGES: Record<string, [string, IconName]> = {
  profile: ["个人资料", "user"],
  schedules: ["定时任务", "clock"],
  accounts: ["账户", "link"],
  models: ["AI 模型", "ai"],
  memory: ["记忆", "brain"],
  skills: ["技能", "skill"],
  security: ["安全", "lock"],
  about: ["关于", "info"],
};
export const GROUPS = [["profile", "schedules", "accounts", "models"], ["memory", "skills"], ["security", "about"]];

export async function testProvider(id: string) {
  return api<{ ok: boolean; model?: string; error?: string }>(`/api/settings/providers/${id}/test`, { method: "POST", body: {} });
}
const NOT_CHAT = /research|image|live|computer|tts|audio|embed|search|batch|realtime|transcribe/i;
/** Makes a provider the default for both model slots, picking a chat model (preferring free ones on OpenRouter is the caller's job). */
export async function useProviderAsDefault(id: string, prefer?: (m: { id: string }, list: { id: string }[]) => boolean) {
  const list = (await api<{ id: string }[]>(`/api/settings/models?provider=${enc(id)}`)).filter((m) => !NOT_CHAT.test(m.id));
  if (!list.length) return null;
  const main = (prefer && list.find((m) => prefer(m, list))) ?? list[0]!;
  // With a preference (free models), the small slot uses the same model rather than a paid "mini".
  const small = prefer ? main : list.find((m) => /mini|flash|haiku|small|lite/i.test(m.id)) ?? main;
  await api("/api/settings/model", { method: "PUT", body: { model: { provider: id, modelId: main.id }, smallModel: { provider: id, modelId: small.id } } });
  return main.id;
}
