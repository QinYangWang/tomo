export type ModelRef = { provider: string; modelId: string };
export type Provider = { id: string; label: string; hint: string; key: { set: boolean; last4?: string }; fromEnv: boolean };
export type ChannelState = "connected" | "connecting" | "error" | "off";
export type Channel = {
  id: "telegram" | "discord" | "slack";
  enabled: boolean;
  fields: Record<string, { set: boolean; last4?: string; fromEnv?: boolean }>;
  status: { state: ChannelState; error?: string };
};
export type Profile = Partial<Record<"name" | "nickname" | "birthday" | "email" | "phone" | "home" | "work" | "household" | "interests" | "pets", string>>;
export type Settings = {
  providers: Provider[];
  model: ModelRef;
  smallModel: ModelRef;
  channels: Channel[];
  owners: string[];
  ownersFromEnv: string[];
  profile: Profile;
  onboarded: boolean;
};
export type Panel = { id: string; title: string; request: string; body: string; status: "ready" | "building" | "error"; error?: string; cadence: string; updated_at: number };
export type Schedule = { id: string; title: string; kind: string; spec: string; next_run: number | null };
export type Memory = { id: number; content: string; subject: string; confidence: string; updated_at: number };
export type Project = { id: string; name: string; status: "active" | "archived"; brief?: string; updated_at: number; conversation_id?: string };
export type Conversation = { id: string; key: string; platform: string };
export type Skill = { name: string; description: string };
export type Hit = { entryId: string; role: string; text: string; at?: number };
