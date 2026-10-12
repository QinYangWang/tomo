import { api, enc, session } from "../api.ts";
import type { IconName } from "../icons.tsx";
import type { Channel, Provider } from "../types.ts";

export const CH: Record<Channel["id"], { label: string; fields: Record<string, string>; steps: string[] }> = {
  telegram: { label: "Telegram", fields: { token: "Bot Token" }, steps: ["在 Telegram 里找 @BotFather，发送 /newbot", "按提示起名，把它给的 Token 粘贴到这里"] },
  discord: { label: "Discord", fields: { token: "Bot Token" }, steps: ["Discord Developer Portal → New Application → Bot → Reset Token", "同一页打开 Message Content Intent", "OAuth2 → URL Generator 勾 bot，用生成的链接把机器人拉进服务器"] },
  slack: { label: "Slack", fields: { botToken: "Bot Token（xoxb-）", appToken: "App Token（xapp-）" }, steps: ["api.slack.com/apps → Create New App", "打开 Socket Mode，生成 App Token，scope 选 connections:write", "OAuth & Permissions 加 Bot scopes：app_mentions:read chat:write im:history im:read im:write", "Event Subscriptions 订阅 app_mention、message.im；App Home 里允许发消息", "Install to Workspace，复制 Bot Token"] },
};
export const STATE: Record<string, [string, string]> = { connected: ["已连接", "ok"], connecting: ["连接中", "warn"], error: ["连不上", "err"], off: ["未连接", ""] };
export const dotCls = (s: string) => STATE[s]?.[1] ?? "";
export const ready = (p: Provider) => p.key.set || p.fromEnv;
export const chHasToken = (c: Channel) => Object.keys(CH[c.id].fields).every((f) => c.fields[f]?.last4 || c.fields[f]?.fromEnv);
export const chState = (c: Channel): [string, string] => (!chHasToken(c) ? ["未连接", ""] : !c.enabled ? ["已暂停", ""] : STATE[c.status.state] ?? ["", ""]);

/** Settings pages: name (2–4 字), icon, one-line description (≤ 20 字). */
export const PAGES: Record<string, [string, IconName, string]> = {
  profile: ["个人资料", "user", "Tomo 回答时会参考"],
  accounts: ["聊天软件", "link", "在这些软件里也能找 Tomo"],
  models: ["AI 模型", "ai", "Tomo 用哪个模型思考"],
  storage: ["存储", "storage", "项目文件存在哪里"],
  backup: ["备份", "backup", "每天自动备份一次"],
  security: ["账号安全", "lock", "绑定账号和登录密码"],
  about: ["关于", "info", "版本和数据位置"],
};
export const GROUPS = [["profile"], ["accounts", "models", "storage", "backup"], ["security", "about"]];
/** Top-level tool pages, each with its own route and layout. */
export const TOOLS: Record<string, [string, IconName, string]> = {
  schedules: ["定时", "clock", "到点自动做的事"],
  memory: ["记忆", "brain", "Tomo 记住的关于你的事"],
  skills: ["技能", "skill", "Tomo 自己学会的做法"],
};

export async function logout() {
  await api("/api/auth/logout", { method: "POST" });
  session.set("");
  location.reload();
}

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
