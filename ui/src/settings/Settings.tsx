// Settings: the sidebar lists the pages on wide screens; phones get the index list. The top bar's back button walks up.
import { Btn, Field, IconBtn, Pick, Toggle } from "../components/kit.tsx";
import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { api, enc, session } from "../api.ts";
import { Icon, type IconName } from "../icons.tsx";
import { invalidate, useModels, useSettings } from "../queries.ts";
import { confirmDialog, isPhone, toast } from "../store.tsx";
import type { Channel, Provider, Settings } from "../types.ts";
import { CH, chHasToken, chState, GROUPS, logout, PAGES, ready, testProvider, TOOLS, useProviderAsDefault } from "./shared.ts";

import { Badge, Btns, Chevron as Arrow, Grow, Group, KV, Logo, Msg, Note, Pad, Pill, Row, RowButton, RowLink, SectionTitle, Sub, type Flash } from "../components/ui.tsx";

const Val = ({ children }: { children: ReactNode }) => <span className="val shrink-0 truncate text-xs text-muted-foreground">{children}</span>;
const Steps = ({ items }: { items: ReactNode[] }) => <ol className="steps list-decimal space-y-1.5 pl-5 text-sm leading-6 text-muted-foreground marker:text-muted-foreground/60">{items.map((s, i) => <li key={i}>{s}</li>)}</ol>;
const Mono = ({ label }: { label: string }) => <Logo>{label[0]}</Logo>;
const Code = ({ children, id }: { children: ReactNode; id?: string }) => <code id={id} className="rounded-md bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>;

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
  const row = (k: string, [label, icon]: [string, IconName, string], to: () => void) => (
    <RowButton key={k} data-k={k} onClick={to}>
      <span className="text-muted-foreground"><Icon name={icon} /></span><Grow>{label}</Grow><Val>{vals[k] ?? ""}</Val><Arrow />
    </RowButton>
  );
  return (
    <>
      <Link className="setHead mb-6 flex items-center gap-4 rounded-3xl border border-border bg-card p-4" to="/settings/$page" params={{ page: "profile" }}>
        <span className="avatar grid size-14 shrink-0 place-items-center rounded-full bg-foreground text-xl font-semibold text-background">{who ? [...who][0]!.toUpperCase() : <Icon name="user" size={26} />}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="setName truncate text-lg font-semibold tracking-tight">{who || "你好"}</span>
          <span className="setSub truncate text-sm text-muted-foreground">{who ? P.email || P.work || "" : "填写资料"}</span>
        </span>
        <Arrow />
      </Link>
      <Group>{Object.entries(TOOLS).map(([k, v]) => row(k, v, () => nav({ to: `/${k}` as "/" })))}</Group>
      {GROUPS.map((g, i) => <Group key={i} className="mt-4">{g.map((k) => row(k, PAGES[k]!, () => nav({ to: "/settings/$page", params: { page: k } })))}</Group>)}
      <Group className="logoutRow mt-4"><RowButton onClick={logout} className="text-destructive"><Icon name="logout" /><Grow>退出登录</Grow></RowButton></Group>
    </>
  );
}

export function SettingsPage({ page, children }: { page: string; children?: ReactNode }) {
  const body: Record<string, () => ReactNode> = { profile: () => <ProfilePage />, accounts: () => <AccountsPage />, models: () => <ModelsPage />, storage: () => <StoragePage />, backup: () => <BackupPage />, security: () => <SecurityPage />, about: () => <AboutPage /> };
  if (TOOLS[page]) return <Navigate to={`/${page}` as "/"} replace />;
  return (
    <>
      <h1 className="setTitle text-[28px] font-semibold tracking-tight">{PAGES[page]?.[0] ?? ""}</h1>
      {PAGES[page] && <p className="setDesc mt-1 mb-6 text-sm text-muted-foreground">{PAGES[page]![2]}</p>}
      <div className="setBody">{children ?? body[page]?.()}</div>
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
  const save = async (k: string, v: string) => {
    if ((S.profile as Record<string, string>)[k] === v.trim() || (!(S.profile as Record<string, string>)[k] && !v.trim())) return;
    await api("/api/settings/profile", { method: "PUT", body: { [k]: v } });
    invalidate("settings");
    toast("已保存");
  };
  return (
    <>
      {PROFILE.map((g, i) => (
        <Group key={i} className={i ? "mt-4" : ""}>
          {g.map(([k, label, ph]) => (
            <KV key={k} label={label} defaultValue={(S.profile as Record<string, string>)[k] ?? ""} placeholder={ph} autoComplete="off" onBlur={(e) => save(k, e.target.value)} />
          ))}
        </Group>
      ))}
      <Note>只存在你自己的服务器上</Note>
    </>
  );
}

// ---- Messaging platforms; each row opens its own page ----
export function AccountsPage() {
  const S = useSettings().data;
  const nav = useNavigate();
  if (!S) return null;
  const open = (account: string) => nav({ to: "/settings/accounts/$account", params: { account } });
  const rows = S.channels.map((c) => {
    const [st, cls] = chState(c);
    return { id: `channel:${c.id}`, label: CH[c.id].label, logo: <Logo><Icon name={c.id} size={18} /></Logo>, right: chHasToken(c) ? <Badge tone={cls as "ok"}>{st}</Badge> : <Pill>连接</Pill> };
  });
  return (
    <Group>
      {rows.map((r) => (
        <RowButton key={r.id} className="acct" data-a={r.id} onClick={() => open(r.id)}>
          {r.logo}<Grow className="aName font-medium">{r.label}</Grow>{r.right}
        </RowButton>
      ))}
    </Group>
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
      <h1 className="setTitle mb-6 text-[28px] font-semibold tracking-tight">{c ? CH[c.id].label : p?.label}</h1>
      <div className="setBody">{c ? <ChannelForm c={c} /> : p ? <ProviderForm p={p} S={S} /> : <div className="empty py-10 text-center text-sm text-muted-foreground">找不到这一项</div>}</div>
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
  // The button saves tokens and connects; the toggle only pauses or resumes a channel that already has them.
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
      <Group>
        <Row>
          <Logo><Icon name={c.id} size={18} /></Logo>
          <Grow className="flex items-center gap-2 font-medium">{meta.label} <Badge tone={cls as "ok"}>{st}</Badge></Grow>
          {has && <Toggle className={on && c.status.state !== "connected" ? "pending" : ""} checked={on} label={`开关 ${meta.label}`} onChange={(v) => save(v, false)} />}
        </Row>
        {Object.entries(meta.fields).map(([f, label]) => {
          const v = c.fields[f] ?? { set: false }, now = v.last4 ? `已保存 ····${v.last4}` : v.fromEnv ? "配置文件里已有" : "";
          return (
            <Field key={f} label={<>{label} {now && <Badge>{now}</Badge>}</>} type="password" autoComplete="off" placeholder={now ? "留空就不改" : "粘贴到这里"} value={vals[f] ?? ""} onChange={(v) => setVals({ ...vals, [f]: v })} />
          );
        })}
        <Pad><Btns><Btn disabled={busy} onClick={() => save(true, true)}>连接</Btn><Msg m={m} /></Btns></Pad>
      </Group>
      <SectionTitle>怎么获取</SectionTitle>
      <Group><Pad><Steps items={meta.steps} /></Pad></Group>
      <Note>连上后，到「账号安全」绑定你自己</Note>
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
    <>
      <Group>
        <Row>
          <Mono label={p.label} />
          <Grow className="flex items-center gap-2 font-medium">{p.label} {p.key.set ? <Badge tone="ok">已添加</Badge> : p.fromEnv ? <Badge tone="ok">配置文件里已有</Badge> : <Badge>未添加</Badge>}</Grow>
          {p.key.set && <Btn kind="danger" onClick={del}>删除</Btn>}
        </Row>
        <Field label="密钥（API Key）" hint={p.hint} type="password" autoComplete="off" placeholder={p.key.set ? `已保存 ····${p.key.last4}，粘贴新的可替换` : "粘贴到这里"} value={key} onChange={setKey} />
        <Pad><Btns><Btn onClick={save}>保存</Btn><Btn kind="secondary" disabled={!ready(p)} onClick={test}>试一下</Btn><Msg m={m} /></Btns></Pad>
      </Group>
      <Note>加密保存，只显示末 4 位</Note>
    </>
  );
}

function ModelSelect({ label, value, usable, onChange }: { label: string; value: { provider: string; modelId: string }; usable: Provider[]; onChange: (v: { provider: string; modelId: string }) => void }) {
  const models = useModels(value.provider).data ?? [];
  useEffect(() => {
    if (models.length && !models.some((m) => m.id === value.modelId)) onChange({ ...value, modelId: models[0]!.id });
  }, [models]);
  return (
    <Pad>
      <label className="px-1 text-xs font-medium text-muted-foreground">{label}</label>
      <div className="row2 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Pick value={value.provider} onChange={(v) => onChange({ provider: v, modelId: "" })} options={usable.map((p) => ({ value: p.id, label: p.label }))} label={`${label} · 供应商`} />
        <Pick value={value.modelId} onChange={(v) => onChange({ ...value, modelId: v })} options={models.map((m) => ({ value: m.id, label: m.name }))} label={`${label} · 模型`} search />
      </div>
    </Pad>
  );
}
function ModelsPage() {
  const S = useSettings().data;
  const nav = useNavigate();
  const [main, setMain] = useState<{ provider: string; modelId: string } | null>(null);
  const [small, setSmall] = useState<{ provider: string; modelId: string } | null>(null);
  const [m, setM] = useState<Flash>(null);
  const usable = S?.providers.filter(ready) ?? [];
  useEffect(() => {
    if (!S || !usable.length) return;
    const fix = (r: { provider: string; modelId: string }) => (usable.some((p) => p.id === r.provider) ? r : { provider: usable[0]!.id, modelId: "" });
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
      <SectionTitle>服务商</SectionTitle>
      <Group>
        {S.providers.map((p) => (
          <RowButton key={p.id} className="acct" data-a={`provider:${p.id}`} onClick={() => nav({ to: "/settings/models/$account", params: { account: `provider:${p.id}` } })}>
            <Mono label={p.label} /><Grow><span className="aName font-medium">{p.label}</span>{S.model.provider === p.id && ready(p) && <Sub>正在用</Sub>}</Grow>
            {ready(p) ? <Badge tone="ok">已添加</Badge> : <Pill>添加</Pill>}
          </RowButton>
        ))}
      </Group>
      <SectionTitle>用哪个</SectionTitle>
      {usable.length ? main && small && (
        <Group className="overflow-visible">
          <ModelSelect label="聊天" value={main} usable={usable} onChange={setMain} />
          <ModelSelect label="后台（整理记忆、更新面板）" value={small} usable={usable} onChange={setSmall} />
          <Pad><Btns><Btn onClick={save}>保存</Btn><Msg m={m} /></Btns></Pad>
        </Group>
      ) : <Note>先添加一家服务商</Note>}
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
      <Group>
        <Row data-storage={st.kind}>
          <span className="text-muted-foreground"><Icon name="storage" /></span>
          <Grow className="font-medium">{st.kind === "s3" ? st.s3?.bucket : "本机"}</Grow>
          <Badge tone={st.kind === "s3" ? "ok" : ""}>{st.kind === "s3" ? "S3" : "默认"}</Badge>
          {st.kind === "s3" && !st.fromEnv && <Btn kind="danger" disabled={busy} onClick={() => save(true)}>改回本机</Btn>}
        </Row>
      </Group>
      <SectionTitle>存到 S3</SectionTitle>
      <Group id="s3Form">
        {S3_FIELDS.map(([k, label, ph]) => (
          <KV key={k} label={label} name={k} value={vals[k] ?? ""} placeholder={ph} autoComplete="off" onChange={(e) => setVals({ ...vals, [k]: e.target.value })} />
        ))}
        <KV label="密钥" name="secret" type="password" value={secret} placeholder={now ? `${now}，留空不改` : "Secret Access Key"} autoComplete="off" onChange={(e) => setSecret(e.target.value)} />
        <Pad><Btns><Btn disabled={busy} onClick={() => save()}>保存</Btn><Btn kind="secondary" disabled={busy} onClick={test}>试一下</Btn><Msg m={m} /></Btns></Pad>
      </Group>
      <Note>支持 Cloudflare R2、AWS S3、MinIO</Note>
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
      <Group>
        <Row><span className="text-muted-foreground"><Icon name="backup" /></span><Grow className="font-medium">自动备份</Grow><Toggle checked={b.enabled} label="自动备份" onChange={toggle} /></Row>
        <Row id="lastBackup">
          <Grow>上次备份<Sub>{last ? (last.ok ? `${when(last.at)} · ${size(last.bytes)}` : `失败：${last.error}`) : "还没有"}</Sub></Grow>
          <Badge tone={last?.ok ? "ok" : last ? "err" : ""}>{b.storage === "s3" ? "S3" : "本机"}</Badge>
        </Row>
        <Pad><Btns><Btn disabled={busy} onClick={run}>立即备份</Btn><Msg m={m} /></Btns></Pad>
      </Group>
      <Note>每天 4 点备份到「存储」里设的位置，保留最近 {b.keep} 份</Note>
      <SectionTitle>恢复码</SectionTitle>
      <Group>
        <Row><code className="grow min-w-0 flex-1 break-all font-mono text-[13px] tracking-wider" id="recoveryCode">{code ?? "••••-••••-••••-••••-••••-••••"}</code>
          {code ? <IconBtn icon="copy" label="复制" size={16} onClick={() => navigator.clipboard?.writeText(code).then(() => toast("已复制"))} />
            : <Btn kind="secondary" size="sm" onClick={async () => setCode((await api<{ code: string }>("/api/settings/backup/code")).code)}>显示</Btn>}
        </Row>
      </Group>
      <Note>备份是加密的，没有恢复码打不开。请抄下来，存在别处</Note>
      {b.list.length > 0 && (
        <>
          <SectionTitle>最近的备份 · {b.list.length}</SectionTitle>
          <Group id="backupList">{b.list.slice(0, 5).map((x) => <Row key={x.key}><Grow className="tabular-nums">{when(x.at)}</Grow></Row>)}</Group>
        </>
      )}
      <SectionTitle>怎么恢复</SectionTitle>
      <Group><Pad><Steps items={["新机器上放好 Tomo，设置好同一个存储", <>运行 <Code>bun run src/restore.ts --code 你的恢复码</Code></>, "启动 Tomo"]} /></Pad></Group>
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
      <SectionTitle>绑定的账号</SectionTitle>
      <Group>
        {S.owners.length ? S.owners.map((o) => (
          <Row key={o}><Grow><Code>{o}</Code></Grow>{env.has(o) ? <Badge>配置文件</Badge> : <Btn kind="danger" onClick={async () => { await api(`/api/settings/owners/${enc(o)}`, { method: "DELETE" }); invalidate("settings"); }}>解绑</Btn>}</Row>
        )) : <Row className="text-muted-foreground">还没有绑定</Row>}
        <Pad>
          <Btns><Btn kind="secondary" onClick={async () => setCode((await api("/api/settings/pair", { method: "POST" })).code)}>获取绑定码</Btn></Btns>
          {code && <div className="flex flex-col items-center gap-2 py-3"><div className="code font-mono text-4xl font-semibold tracking-[0.3em]">{code}</div><p className="text-center text-xs text-muted-foreground">10 分钟内私聊机器人发送 <Code>/pair {code}</Code></p></div>}
        </Pad>
      </Group>
      <Note>绑定后，只有你能私聊 Tomo</Note>
      <SectionTitle>登录密码</SectionTitle>
      <Group>
        <Field label="当前密码" type="password" autoComplete="current-password" value={cur} onChange={setCur} />
        <Field label="新密码（至少 8 位）" type="password" autoComplete="new-password" value={nxt} onChange={setNxt} />
        <Pad><Btns><Btn onClick={change}>修改</Btn><Msg m={m} /></Btns></Pad>
      </Group>
      <Note>改完后，其他设备要重新登录</Note>
    </>
  );
}

function AboutPage() {
  return (
    <>
      <Group>
        <Row><span className="text-primary"><Icon name="sparkles" /></span><Grow className="font-medium">Tomo</Grow><Val>你的私人助手</Val></Row>
        <RowLink href="https://github.com/QinYangWang/tomo"><Grow>源代码</Grow><Arrow /></RowLink>
      </Group>
      <Note>备份时，复制整个 data 文件夹</Note>
    </>
  );
}
