// Settings: the sidebar lists the pages on wide screens; phones get the index list. The top bar's back button walks up.
import { Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { siAnthropic, siDeepseek, siDiscord, siGooglegemini, siMistralai, siOpenrouter, siTelegram } from "simple-icons";
import { BotIcon, ChatIcon, CopyIcon, LogOutIcon, ServerIcon, HistoryIcon, SparklesIcon } from "@/components/icons";
import { Avatar, AvatarFallback } from "@/ui/avatar";
import { Badge } from "@/ui/badge";
import { BrandIcon } from "@/ui/brand-icon";
import { Button } from "@/ui/button";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxItem, ComboboxList, ComboboxSearch, ComboboxTrigger, ComboboxValue } from "@/ui/combobox";
import { Field, FieldDescription, FieldLabel } from "@/ui/field";
import { IconChip } from "@/ui/icon-chip";
import { Input } from "@/ui/input";
import { PasswordInput } from "@/ui/password-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import { SettingsFooterNote, SettingsGroup, SettingsGroupFooter, SettingsRow, SettingsRowControl, SettingsRowDescription, SettingsRowText, SettingsRowTitle } from "@/ui/settings-section";
import { Switch } from "@/ui/switch";
import { api, enc, session } from "../api.ts";
import { Head, LinkRow, Msg, Section, Steps, ToolbarButton, type Flash } from "../components/parts.tsx";
import { PAGE_ICON } from "../components/Sidebar.tsx";
import { invalidate, useModels, useSettings } from "../queries.ts";
import { confirmDialog, isPhone, toast } from "../store.tsx";
import type { Channel, Provider, Settings } from "../types.ts";
import { CH, chHasToken, chState, GROUPS, logout, PAGES, ready, testProvider, TOOLS, useProviderAsDefault } from "./shared.ts";

const Val = ({ children }: { children: ReactNode }) => <span className="shrink-0 truncate text-ui-sm text-muted-foreground">{children}</span>;
const Code = ({ children, id }: { children: ReactNode; id?: string }) => <code id={id} className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-ui-sm">{children}</code>;
const RowIcon = ({ children }: { children: ReactNode }) => <span className="flex shrink-0 text-muted-foreground [&_svg]:size-4">{children}</span>;
/** Footer band of a group: a feedback line on the left, the buttons on the right. */
const Footer = ({ m, children, msgId }: { m: Flash; children: ReactNode; msgId?: string }) => (
  <SettingsGroupFooter>
    <SettingsFooterNote><Msg m={m} id={msgId} /></SettingsFooterNote>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </SettingsGroupFooter>
);
/** Label on the left, a control on the right (wraps under the label on phones). */
function KV({ label, k, children }: { label: string; k: string; children: ReactNode }) {
  return (
    <SettingsRow data-kv={k}>
      <SettingsRowText className="basis-24"><SettingsRowTitle>{label}</SettingsRowTitle></SettingsRowText>
      <SettingsRowControl className="w-full sm:w-80">{children}</SettingsRowControl>
    </SettingsRow>
  );
}

/** Channel and provider marks: the real logo where the brand set has one, a neutral glyph otherwise. */
const CH_ICON: Record<string, ReactNode> = { telegram: <BrandIcon icon={siTelegram} />, discord: <BrandIcon icon={siDiscord} />, slack: <ChatIcon /> };
const PROVIDER_ICON: Record<string, ReactNode> = {
  anthropic: <BrandIcon icon={siAnthropic} />, google: <BrandIcon icon={siGooglegemini} />, openrouter: <BrandIcon icon={siOpenrouter} />,
  deepseek: <BrandIcon icon={siDeepseek} />, mistral: <BrandIcon icon={siMistralai} />,
};
const Mark = ({ children }: { children: ReactNode }) => <IconChip size="sm">{children}</IconChip>;
const okBadge = (text: string) => <Badge variant="success" size="sm">{text}</Badge>;

export function SettingsRoot() {
  const S = useSettings().data;
  const nav = useNavigate();
  // Wide screens show the settings nav in the sidebar, so the index is just the first page.
  useEffect(() => void (!isPhone() && nav({ to: "/settings/$page", params: { page: "profile" }, replace: true })), []);
  if (!S) return null;
  const P = S.profile ?? {};
  const who = P.nickname || P.name || "";
  const key = S.providers.some(ready);
  const n = S.channels.filter((c) => c.enabled && c.status.state === "connected").length;
  const vals: Record<string, string> = { profile: who ? "" : "未填写", accounts: n ? `${n} 个已连接` : "未连接", models: key ? S.model.modelId.split("/").pop()! : "未设置" };
  const row = (k: string, label: string, to: () => void) => (
    <LinkRow key={k} data-k={k} onClick={to}>
      <RowIcon>{PAGE_ICON[k]}</RowIcon>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <Val>{vals[k] ?? ""}</Val>
    </LinkRow>
  );
  return (
    <>
      <SettingsGroup className="setHead">
        <LinkRow onClick={() => nav({ to: "/settings/$page", params: { page: "profile" } })}>
          <Avatar size="lg"><AvatarFallback>{who ? [...who][0]!.toUpperCase() : "?"}</AvatarFallback></Avatar>
          <SettingsRowText>
            <SettingsRowTitle className="text-ui-lg">{who || "你好"}</SettingsRowTitle>
            <SettingsRowDescription>{who ? P.email || P.work || "" : "填写资料"}</SettingsRowDescription>
          </SettingsRowText>
        </LinkRow>
      </SettingsGroup>
      <SettingsGroup>{Object.entries(TOOLS).map(([k, v]) => row(k, v[0], () => nav({ to: `/${k}` as "/" })))}</SettingsGroup>
      {GROUPS.map((g, i) => <SettingsGroup key={i}>{g.map((k) => row(k, PAGES[k]![0], () => nav({ to: "/settings/$page", params: { page: k } })))}</SettingsGroup>)}
      <SettingsGroup className="logoutRow">
        <LinkRow onClick={logout} chevron={false}><RowIcon><LogOutIcon /></RowIcon><span className="flex-1 text-destructive">退出登录</span></LinkRow>
      </SettingsGroup>
    </>
  );
}

export function SettingsPage({ page }: { page: string }) {
  const body: Record<string, () => ReactNode> = { profile: () => <ProfilePage />, accounts: () => <AccountsPage />, models: () => <ModelsPage />, storage: () => <StoragePage />, backup: () => <BackupPage />, security: () => <SecurityPage />, about: () => <AboutPage /> };
  if (TOOLS[page]) return <Navigate to={`/${page}` as "/"} replace />;
  return (
    <>
      <Head title={PAGES[page]?.[0] ?? ""} desc={PAGES[page]?.[2]} />
      {body[page]?.()}
    </>
  );
}

const PROFILE: [string, string, string][][] = [
  [["name", "姓名", "你的名字"], ["nickname", "称呼", "Tomo 怎么叫你"], ["birthday", "生日", "如 1999-01-03"]],
  [["email", "邮箱", "you@example.com"], ["phone", "电话", "+86 138 0000 0000"], ["home", "住址", "城市或地址"], ["work", "工作", "职位和公司"]],
  [["household", "家人", "如：伴侣、两个孩子"], ["interests", "爱好", "如：设计、木工"], ["pets", "宠物", "如：狗狗 Max"]],
];
function ProfilePage() {
  const S = useSettings().data;
  if (!S) return null;
  const P = S.profile as Record<string, string>;
  const save = async (k: string, v: string) => {
    if (P[k] === v.trim() || (!P[k] && !v.trim())) return;
    await api("/api/settings/profile", { method: "PUT", body: { [k]: v } });
    invalidate("settings");
    toast("已保存");
  };
  return (
    <>
      {PROFILE.map((g, i) => (
        <SettingsGroup key={i}>
          {g.map(([k, label, ph]) => (
            <KV key={k} k={k} label={label}><Input aria-label={label} defaultValue={P[k] ?? ""} placeholder={ph} autoComplete="off" onBlur={(e) => save(k, e.target.value)} /></KV>
          ))}
        </SettingsGroup>
      ))}
      <p className="note px-1 text-ui-sm text-muted-foreground">只存在你自己的服务器上</p>
    </>
  );
}

// ---- Messaging platforms; each row opens its own page ----
export function AccountsPage() {
  const S = useSettings().data;
  const nav = useNavigate();
  if (!S) return null;
  return (
    <SettingsGroup>
      {S.channels.map((c) => {
        const [st, cls] = chState(c);
        return (
          <LinkRow key={c.id} data-a={`channel:${c.id}`} onClick={() => nav({ to: "/settings/accounts/$account", params: { account: `channel:${c.id}` } })}>
            <Mark>{CH_ICON[c.id]}</Mark>
            <span className="min-w-0 flex-1 truncate font-medium">{CH[c.id].label}</span>
            {chHasToken(c) ? <Badge size="sm" variant={cls === "ok" ? "success" : cls === "err" ? "destructive" : cls === "warn" ? "warning" : "chip"}>{st}</Badge> : <Badge size="sm" variant="primary">连接</Badge>}
          </LinkRow>
        );
      })}
    </SettingsGroup>
  );
}

export function AccountPage({ account }: { account: string }) {
  const S = useSettings().data;
  const [kind, id] = account.split(":") as [string, string];
  if (!S) return null;
  const c = kind === "channel" ? S.channels.find((x) => x.id === id) : undefined;
  const p = kind === "provider" ? S.providers.find((x) => x.id === id) : undefined;
  return (
    <>
      <Head title={c ? CH[c.id].label : p?.label ?? ""} />
      {c ? <ChannelForm c={c} /> : p ? <ProviderForm p={p} S={S} /> : <p className="text-ui text-muted-foreground">找不到这一项</p>}
    </>
  );
}

function ChannelForm({ c }: { c: Channel }) {
  const meta = CH[c.id];
  const has = chHasToken(c);
  const [st, cls] = chState(c);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [m, setM] = useState<Flash>(c.status.state === "error" ? { text: c.status.error ?? "", ok: false } : null);
  const on = has && c.enabled;
  // The button saves tokens and connects; the switch only pauses or resumes a channel that already has them.
  const save = async (enabled: boolean, withTokens: boolean) => {
    const body: Record<string, unknown> = { enabled };
    if (withTokens) for (const [k, v] of Object.entries(vals)) if (v.trim()) body[k] = v.trim();
    setBusy(true);
    setM({ text: "正在连接…", ok: true });
    const r = await api(`/api/settings/channels/${c.id}`, { method: "PUT", body });
    setBusy(false);
    if (r.error) return setM({ text: r.error, ok: false });
    setVals({});
    setM(r.status.state === "error" ? { text: r.status.error, ok: false } : null);
    if (r.status.state === "connected") toast(`${meta.label} 已连接`);
    invalidate("settings");
  };
  return (
    <>
      <SettingsGroup>
        <SettingsRow>
          <Mark>{CH_ICON[c.id]}</Mark>
          <SettingsRowText><SettingsRowTitle className="flex items-center gap-2">{meta.label}<Badge size="sm" variant={cls === "ok" ? "success" : cls === "err" ? "destructive" : cls === "warn" ? "warning" : "chip"}>{st}</Badge></SettingsRowTitle></SettingsRowText>
          {has && <Switch checked={on} aria-label={`开关 ${meta.label}`} onCheckedChange={(v) => save(v, false)} />}
        </SettingsRow>
        {Object.entries(meta.fields).map(([f, label]) => {
          const v = c.fields[f] ?? { set: false }, now = v.last4 ? `已保存 ····${v.last4}` : v.fromEnv ? "配置文件里已有" : "";
          return (
            <SettingsRow key={f}>
              <Field className="w-full">
                <FieldLabel>{label}{now && <Badge size="sm">{now}</Badge>}</FieldLabel>
                <PasswordInput name={f} autoComplete="off" placeholder={now ? "留空就不改" : "粘贴到这里"} value={vals[f] ?? ""} onChange={(e) => setVals({ ...vals, [f]: e.target.value })} />
              </Field>
            </SettingsRow>
          );
        })}
        <Footer m={m}><Button disabled={busy} onClick={() => save(true, true)}>连接</Button></Footer>
      </SettingsGroup>
      <Section title="怎么获取" note="连上后，到「账号安全」绑定你自己">
        <SettingsRow><Steps items={meta.steps} /></SettingsRow>
      </Section>
    </>
  );
}

function ProviderForm({ p, S }: { p: Provider; S: Settings }) {
  const [key, setKey] = useState("");
  const [m, setM] = useState<Flash>(null);
  const test = async () => {
    setM({ text: "正在试…", ok: true });
    const r = await testProvider(p.id);
    setM(r.ok ? { text: `能用 ✓ ${r.model}`, ok: true } : { text: r.error ?? "不能用", ok: false });
  };
  const save = async () => {
    if (!key.trim()) return setM({ text: "先粘贴密钥", ok: false });
    const r = await api(`/api/settings/providers/${p.id}`, { method: "PUT", body: { key } });
    if (r.error) return setM({ text: r.error, ok: false });
    setKey("");
    // The first key ever becomes the default, so Tomo works right away.
    if (!S.providers.some(ready)) await useProviderAsDefault(p.id);
    await invalidate("settings");
    await test();
  };
  const del = async () => {
    if (!(await confirmDialog({ title: `删除 ${p.label} 的密钥？`, body: "用它的模型会停止工作", confirm: "删除", danger: true }))) return;
    await api(`/api/settings/providers/${p.id}`, { method: "DELETE" });
    invalidate("settings");
  };
  return (
    <Section note="加密保存，只显示末 4 位">
      <SettingsRow>
        <Mark>{PROVIDER_ICON[p.id] ?? <BotIcon />}</Mark>
        <SettingsRowText><SettingsRowTitle className="flex items-center gap-2">{p.label}{p.key.set ? okBadge("已添加") : p.fromEnv ? okBadge("配置文件里已有") : <Badge size="sm">未添加</Badge>}</SettingsRowTitle></SettingsRowText>
        {p.key.set && <Button variant="ghost" size="sm" onClick={del}>删除</Button>}
      </SettingsRow>
      <SettingsRow>
        <Field className="w-full">
          <FieldLabel>密钥（API Key）</FieldLabel>
          <PasswordInput autoComplete="off" placeholder={p.key.set ? `已保存 ····${p.key.last4}，粘贴新的可替换` : "粘贴到这里"} value={key} onChange={(e) => setKey(e.target.value)} />
          <FieldDescription>{p.hint}</FieldDescription>
        </Field>
      </SettingsRow>
      <Footer m={m}>
        <Button variant="secondary" disabled={!ready(p)} onClick={test}>试一下</Button>
        <Button onClick={save}>保存</Button>
      </Footer>
    </Section>
  );
}

type Ref = { provider: string; modelId: string };
function ModelSelect({ label, value, usable, onChange }: { label: string; value: Ref; usable: Provider[]; onChange: (v: Ref) => void }) {
  const models = useModels(value.provider).data ?? [];
  useEffect(() => {
    if (models.length && !models.some((m) => m.id === value.modelId)) onChange({ ...value, modelId: models[0]!.id });
  }, [models]);
  const names = useMemo(() => Object.fromEntries(models.map((m) => [m.id, m.name])), [models]);
  return (
    <SettingsRow>
      <SettingsRowText className="basis-40"><SettingsRowTitle>{label}</SettingsRowTitle></SettingsRowText>
      <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-5">
        <Select items={usable.map((p) => ({ value: p.id, label: p.label }))} value={value.provider} onValueChange={(v) => v && onChange({ provider: v as string, modelId: "" })}>
          <SelectTrigger aria-label={`${label} · 供应商`} className="sm:col-span-2"><SelectValue placeholder="选择" /></SelectTrigger>
          <SelectContent>{usable.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
        </Select>
        <Combobox items={models.map((m) => m.id)} itemToStringLabel={(id: string) => names[id] ?? id} value={value.modelId || null} onValueChange={(v) => v && onChange({ ...value, modelId: v })}>
          <ComboboxTrigger aria-label={`${label} · 模型`} className="sm:col-span-3"><ComboboxValue placeholder="选择模型" /></ComboboxTrigger>
          <ComboboxContent>
            <ComboboxSearch placeholder="搜索模型" aria-label="搜索模型" />
            <ComboboxEmpty>没有找到</ComboboxEmpty>
            <ComboboxList>{(id: string) => <ComboboxItem key={id} value={id}>{names[id] ?? id}</ComboboxItem>}</ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
    </SettingsRow>
  );
}
function ModelsPage() {
  const S = useSettings().data;
  const nav = useNavigate();
  const [main, setMain] = useState<Ref | null>(null);
  const [small, setSmall] = useState<Ref | null>(null);
  const [m, setM] = useState<Flash>(null);
  const usable = S?.providers.filter(ready) ?? [];
  useEffect(() => {
    if (!S || !usable.length) return;
    const fix = (r: Ref) => (usable.some((p) => p.id === r.provider) ? r : { provider: usable[0]!.id, modelId: "" });
    setMain((x) => x ?? fix(S.model));
    setSmall((x) => x ?? fix(S.smallModel));
  }, [S]);
  if (!S) return null;
  const save = async () => {
    const r = await api("/api/settings/model", { method: "PUT", body: { model: main, smallModel: small } });
    if (r.error) return setM({ text: r.error, ok: false });
    setM({ text: "已保存", ok: true });
    toast("已保存");
    invalidate("settings");
  };
  return (
    <>
      <Section title="服务商">
        {S.providers.map((p) => (
          <LinkRow key={p.id} data-a={`provider:${p.id}`} onClick={() => nav({ to: "/settings/models/$account", params: { account: `provider:${p.id}` } })}>
            <Mark>{PROVIDER_ICON[p.id] ?? <BotIcon />}</Mark>
            <SettingsRowText>
              <SettingsRowTitle>{p.label}</SettingsRowTitle>
              {S.model.provider === p.id && ready(p) && <SettingsRowDescription>正在用</SettingsRowDescription>}
            </SettingsRowText>
            {ready(p) ? okBadge("已添加") : <Badge size="sm" variant="primary">添加</Badge>}
          </LinkRow>
        ))}
      </Section>
      {usable.length ? main && small && (
        <Section title="用哪个" id="modelForm">
          <ModelSelect label="聊天" value={main} usable={usable} onChange={setMain} />
          <ModelSelect label="后台（整理记忆、更新面板）" value={small} usable={usable} onChange={setSmall} />
          <Footer m={m}><Button id="modelSave" onClick={save}>保存</Button></Footer>
        </Section>
      ) : <p className="note px-1 text-ui-sm text-muted-foreground">先添加一家服务商</p>}
    </>
  );
}

type Storage = { kind: "s3" | "local"; fromEnv: boolean; s3: { endpoint: string; bucket: string; region: string; accessKeyId: string; prefix: string } | null; secret: { set: boolean; last4?: string } };
const S3_FIELDS: [string, string, string][] = [
  ["endpoint", "地址", "https://<账号ID>.r2.cloudflarestorage.com"],
  ["bucket", "存储桶", "tomo"],
  ["region", "区域", "R2 填 auto"],
  ["accessKeyId", "访问 ID", "Access Key ID"],
  ["prefix", "文件夹", "可不填"],
];
function StoragePage() {
  const [st, setSt] = useState<Storage | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [m, setM] = useState<Flash>(null);
  const load = async () => {
    const r = await api<Storage>("/api/settings/storage");
    setSt(r);
    setVals({ region: "auto", ...(r.s3 ?? {}) });
  };
  useEffect(() => void load(), []);
  if (!st) return null;
  const body = () => ({ s3: { ...vals, secretAccessKey: secret || undefined } });
  const test = async () => {
    setM({ text: "正在试…", ok: true });
    const r = await api("/api/settings/storage/test", { method: "POST", body: body() });
    setM(r.ok ? { text: "能用 ✓", ok: true } : { text: r.error ?? "不能用", ok: false });
  };
  const save = async (local = false) => {
    if (local && !(await confirmDialog({ title: "改回存在本机？", body: "项目会复制回这台服务器", confirm: "改回" }))) return;
    setBusy(true);
    setM({ text: local ? "正在复制…" : "正在检查并复制…", ok: true });
    const r = await api("/api/settings/storage", { method: "PUT", body: local ? { s3: null } : body() });
    setBusy(false);
    if (!r.ok) return setM({ text: r.error ?? "保存失败", ok: false });
    setSecret("");
    setM(null);
    toast(local ? "已改回本机" : `已保存，复制了 ${r.copied} 个文件`);
    load();
  };
  const now = st.secret.last4 ? `已保存 ····${st.secret.last4}` : st.fromEnv ? "配置文件里已有" : "";
  return (
    <>
      <SettingsGroup>
        <SettingsRow data-storage={st.kind}>
          <RowIcon><ServerIcon /></RowIcon>
          <SettingsRowText><SettingsRowTitle>{st.kind === "s3" ? st.s3?.bucket : "本机"}</SettingsRowTitle></SettingsRowText>
          <SettingsRowControl>
            <Badge size="sm" variant={st.kind === "s3" ? "success" : "chip"}>{st.kind === "s3" ? "S3" : "默认"}</Badge>
            {st.kind === "s3" && !st.fromEnv && <Button variant="ghost" size="sm" disabled={busy} onClick={() => save(true)}>改回本机</Button>}
          </SettingsRowControl>
        </SettingsRow>
      </SettingsGroup>
      <Section title="存到 S3" id="s3Form" note="支持 Cloudflare R2、AWS S3、MinIO">
        {S3_FIELDS.map(([k, label, ph]) => (
          <KV key={k} k={k} label={label}><Input aria-label={label} name={k} value={vals[k] ?? ""} placeholder={ph} autoComplete="off" onChange={(e) => setVals({ ...vals, [k]: e.target.value })} /></KV>
        ))}
        <KV k="secret" label="密钥"><PasswordInput aria-label="密钥" name="secret" value={secret} placeholder={now ? `${now}，留空不改` : "Secret Access Key"} autoComplete="off" onChange={(e) => setSecret(e.target.value)} /></KV>
        <Footer m={m}>
          <Button variant="secondary" disabled={busy} onClick={test}>试一下</Button>
          <Button disabled={busy} onClick={() => save()}>保存</Button>
        </Footer>
      </Section>
    </>
  );
}

type Backup = { enabled: boolean; keep: number; storage: "s3" | "local"; last: { at: number; ok: boolean; bytes?: number; error?: string } | null; list: { key: string; at: number }[] };
const when = (ms: number) => new Date(ms).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const size = (b?: number) => (!b ? "" : b > 1 << 20 ? `${(b / (1 << 20)).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
function BackupPage() {
  const [b, setB] = useState<Backup | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [m, setM] = useState<Flash>(null);
  useEffect(() => void api<Backup>("/api/settings/backup").then(setB), []);
  if (!b) return null;
  const run = async () => {
    setBusy(true);
    setM({ text: "正在备份…", ok: true });
    const r = await api<Backup & { ok: boolean; error?: string }>("/api/settings/backup/run", { method: "POST" });
    setBusy(false);
    setB(r);
    setM(r.ok ? null : { text: r.error ?? "备份失败", ok: false });
    if (r.ok) toast("备份好了");
  };
  const toggle = async (enabled: boolean) => setB(await api<Backup>("/api/settings/backup", { method: "PUT", body: { enabled } }));
  const last = b.last;
  return (
    <>
      <Section note={`每天 4 点备份到「存储」里设的位置，保留最近 ${b.keep} 份`}>
        <SettingsRow render={<label />}>
          <RowIcon><HistoryIcon /></RowIcon>
          <SettingsRowText><SettingsRowTitle>自动备份</SettingsRowTitle></SettingsRowText>
          <Switch checked={b.enabled} aria-label="自动备份" onCheckedChange={toggle} />
        </SettingsRow>
        <SettingsRow id="lastBackup">
          <SettingsRowText>
            <SettingsRowTitle>上次备份</SettingsRowTitle>
            <SettingsRowDescription>{last ? (last.ok ? `${when(last.at)} · ${size(last.bytes)}` : `失败：${last.error}`) : "还没有"}</SettingsRowDescription>
          </SettingsRowText>
          <Badge size="sm" variant={last?.ok ? "success" : last ? "destructive" : "chip"}>{b.storage === "s3" ? "S3" : "本机"}</Badge>
        </SettingsRow>
        <Footer m={m}><Button disabled={busy} onClick={run}>立即备份</Button></Footer>
      </Section>
      <Section title="恢复码" note="备份是加密的，没有恢复码打不开。请抄下来，存在别处">
        <SettingsRow>
          <code className="min-w-0 flex-1 font-mono text-ui tracking-wider break-all" id="recoveryCode">{code ?? "••••-••••-••••-••••-••••-••••"}</code>
          {code ? <ToolbarButton label="复制" onClick={() => navigator.clipboard?.writeText(code).then(() => toast("已复制"))}><CopyIcon /></ToolbarButton>
            : <Button variant="secondary" size="sm" onClick={async () => setCode((await api<{ code: string }>("/api/settings/backup/code")).code)}>显示</Button>}
        </SettingsRow>
      </Section>
      {b.list.length > 0 && (
        <Section title={`最近的备份 · ${b.list.length}`} id="backupList">
          {b.list.slice(0, 5).map((x) => <SettingsRow key={x.key}><span className="tabular-nums">{when(x.at)}</span></SettingsRow>)}
        </Section>
      )}
      <Section title="怎么恢复">
        <SettingsRow><Steps items={["新机器上放好 Tomo，设置好同一个存储", <>运行 <Code>bun run src/restore.ts --code 你的恢复码</Code></>, "启动 Tomo"]} /></SettingsRow>
      </Section>
    </>
  );
}

function SecurityPage() {
  const S = useSettings().data;
  const [code, setCode] = useState<string | null>(null);
  const [cur, setCur] = useState("");
  const [nxt, setNxt] = useState("");
  const [m, setM] = useState<Flash>(null);
  const owners = S?.owners.length ?? 0;
  // While a pairing code is live, watch for the new owner.
  useEffect(() => {
    if (!code) return;
    const t = setInterval(async () => {
      const s = await api<Settings>("/api/settings");
      if (s.owners.length !== owners) {
        setCode(null);
        toast("绑定成功");
        invalidate("settings");
      }
    }, 3000);
    const stop = setTimeout(() => setCode(null), 600_000);
    return () => (clearInterval(t), clearTimeout(stop));
  }, [code]);
  if (!S) return null;
  const env = new Set(S.ownersFromEnv);
  const change = async () => {
    const r = await api("/api/settings/password", { method: "PUT", body: { current: cur, next: nxt } });
    if (r.token) {
      session.set(r.token);
      setM({ text: "改好了", ok: true });
      setCur("");
      setNxt("");
    } else setM({ text: r.error === "wrong password" ? "当前密码不对" : r.error, ok: false });
  };
  return (
    <>
      <Section title="绑定的账号" note="绑定后，只有你能私聊 Tomo">
        {S.owners.length ? S.owners.map((o) => (
          <SettingsRow key={o}>
            <SettingsRowText><Code>{o}</Code></SettingsRowText>
            {env.has(o) ? <Badge size="sm">配置文件</Badge> : <Button variant="ghost" size="sm" onClick={async () => { await api(`/api/settings/owners/${enc(o)}`, { method: "DELETE" }); invalidate("settings"); }}>解绑</Button>}
          </SettingsRow>
        )) : <SettingsRow><SettingsRowDescription>还没有绑定</SettingsRowDescription></SettingsRow>}
        {code && (
          <SettingsRow className="flex-col">
            <div className="code font-mono text-4xl font-semibold tracking-widest tabular-nums">{code}</div>
            <p className="text-center text-ui-sm text-muted-foreground">10 分钟内私聊机器人发送 <Code>/pair {code}</Code></p>
          </SettingsRow>
        )}
        <SettingsGroupFooter><Button variant="secondary" onClick={async () => setCode((await api("/api/settings/pair", { method: "POST" })).code)}>获取绑定码</Button></SettingsGroupFooter>
      </Section>
      <Section title="登录密码" note="改完后，其他设备要重新登录">
        <SettingsRow><Field className="w-full"><FieldLabel>当前密码</FieldLabel><PasswordInput autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></Field></SettingsRow>
        <SettingsRow><Field className="w-full"><FieldLabel>新密码（至少 8 位）</FieldLabel><PasswordInput autoComplete="new-password" value={nxt} onChange={(e) => setNxt(e.target.value)} /></Field></SettingsRow>
        <Footer m={m}><Button onClick={change}>修改</Button></Footer>
      </Section>
    </>
  );
}

function AboutPage() {
  return (
    <Section note="备份时，复制整个 data 文件夹">
      <SettingsRow>
        <IconChip tone="primary" size="sm"><SparklesIcon /></IconChip>
        <SettingsRowText><SettingsRowTitle>Tomo</SettingsRowTitle></SettingsRowText>
        <Val>你的私人助手</Val>
      </SettingsRow>
      <LinkRow href="https://github.com/QinYangWang/tomo"><span className="flex-1">源代码</span></LinkRow>
    </Section>
  );
}

