// Settings: the sidebar lists the pages on wide screens; phones get the index list. The top bar's back button walks up.
import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { api, enc, session } from "../api.ts";
import { Icon, type IconName } from "../icons.tsx";
import { invalidate, useModels, useSettings } from "../queries.ts";
import { confirmDialog, isPhone, toast } from "../store.tsx";
import type { Channel, Provider, Settings } from "../types.ts";
import { CH, chHasToken, chState, GROUPS, logout, PAGES, ready, testProvider, TOOLS, useProviderAsDefault } from "./shared.ts";

type Flash = { text: string; ok: boolean } | null;
const Msg = ({ m }: { m: Flash }) => (m ? <span className={`msg ${m.ok ? "ok" : "err"}`}>{m.text}</span> : null);
const Arrow = () => <span className="arrow"><Icon name="right" size={16} /></span>;

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
    <button key={k} className="item" data-k={k} onClick={to}>
      <Icon name={icon} /><span className="grow">{label}</span><span className="val">{vals[k] ?? ""}</span><Arrow />
    </button>
  );
  return (
    <>
      <Link className="setHead" to="/settings/$page" params={{ page: "profile" }}>
        <span className="avatar">{who ? [...who][0]!.toUpperCase() : <Icon name="user" size={26} />}</span>
        <span className="grow">
          <span className="setName serif">{who || "你好"}</span>
          <span className="setSub">{who ? P.email || P.work || "" : "填写资料"}</span>
        </span>
      </Link>
      <div className="group">{Object.entries(TOOLS).map(([k, v]) => row(k, v, () => nav({ to: `/${k}` as "/" })))}</div>
      {GROUPS.map((g, i) => <div key={i} className="group">{g.map((k) => row(k, PAGES[k]!, () => nav({ to: "/settings/$page", params: { page: k } })))}</div>)}
      <div className="group logoutRow"><button className="item" onClick={logout}><Icon name="logout" /><span className="grow">退出登录</span></button></div>
    </>
  );
}

export function SettingsPage({ page, children }: { page: string; children?: ReactNode }) {
  const body: Record<string, () => ReactNode> = { profile: () => <ProfilePage />, accounts: () => <AccountsPage />, models: () => <ModelsPage />, security: () => <SecurityPage />, about: () => <AboutPage /> };
  if (TOOLS[page]) return <Navigate to={`/${page}` as "/"} replace />;
  return (
    <>
      <h1 className="setTitle serif">{PAGES[page]?.[0] ?? ""}</h1>
      {PAGES[page] && <p className="setDesc">{PAGES[page]![2]}</p>}
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
        <div key={i} className="group">
          {g.map(([k, label, ph]) => (
            <label key={k} className="item kv"><span className="k">{label}</span><input defaultValue={(S.profile as Record<string, string>)[k] ?? ""} placeholder={ph} autoComplete="off" onBlur={(e) => save(k, e.target.value)} /></label>
          ))}
        </div>
      ))}
      <p className="note">只存在你自己的服务器上</p>
    </>
  );
}

// ---- Messaging platforms; each row opens its own page ----
const Mono = ({ label }: { label: string }) => <span className="logo mono">{label[0]}</span>;
export function AccountsPage() {
  const S = useSettings().data;
  const nav = useNavigate();
  if (!S) return null;
  const open = (account: string) => nav({ to: "/settings/accounts/$account", params: { account } });
  const rows = S.channels.map((c) => {
    const [st, cls] = chState(c);
    return { id: `channel:${c.id}`, label: CH[c.id].label, logo: <span className="logo"><Icon name={c.id} /></span>, sub: "", right: chHasToken(c) ? <span className={`badge ${cls}`}>{st}</span> : <span className="pillBtn">连接</span> };
  });
  return (
    <div className="group">
      {rows.map((r) => (
        <button key={r.id} className="item acct" data-a={r.id} onClick={() => open(r.id)}>
          {r.logo}<span className="grow"><span className="aName">{r.label}</span><span className="aSub">{r.sub}</span></span>{r.right}
        </button>
      ))}
    </div>
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
      <h1 className="setTitle serif">{c ? CH[c.id].label : p?.label}</h1>
      <div className="setBody">{c ? <ChannelForm c={c} /> : p ? <ProviderForm p={p} S={S} /> : <div className="empty">找不到这一项</div>}</div>
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
      <div className="group">
        <div className="item">
          <span className="logo"><Icon name={c.id} /></span>
          <span className="grow">{meta.label} <span className={`badge ${cls}`}>{st}</span></span>
          {has && <input type="checkbox" className={`toggle ${on && c.status.state !== "connected" ? "pending" : ""}`} checked={on} aria-label={`开关 ${meta.label}`} onChange={(e) => save(e.target.checked, false)} />}
        </div>
        {Object.entries(meta.fields).map(([f, label]) => {
          const v = c.fields[f] ?? { set: false }, now = v.last4 ? `已保存 ····${v.last4}` : v.fromEnv ? "配置文件里已有" : "";
          return (
            <div key={f} className="field">
              <label>{label} {now && <span className="badge">{now}</span>}</label>
              <input type="password" autoComplete="off" placeholder={now ? "留空就不改" : "粘贴到这里"} value={vals[f] ?? ""} onChange={(e) => setVals({ ...vals, [f]: e.target.value })} />
            </div>
          );
        })}
        <div className="field"><div className="btns"><button className="primary" disabled={busy} onClick={() => save(true, true)}>连接</button><Msg m={m} /></div></div>
      </div>
      <div className="gtitle">怎么获取</div>
      <div className="group"><div className="field"><ol className="steps">{meta.steps.map((s) => <li key={s}>{s}</li>)}</ol></div></div>
      <p className="note">连上后，到「账号安全」绑定你自己</p>
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
      <div className="group">
        <div className="item">
          <Mono label={p.label} />
          <span className="grow">{p.label} {p.key.set ? <span className="badge ok">已添加</span> : p.fromEnv ? <span className="badge ok">配置文件里已有</span> : <span className="badge">未添加</span>}</span>
          {p.key.set && <button className="dangerBtn" onClick={del}>删除</button>}
        </div>
        <div className="field">
          <label>密钥（API Key）</label>
          <input type="password" autoComplete="off" placeholder={p.key.set ? `已保存 ····${p.key.last4}，粘贴新的可替换` : "粘贴到这里"} value={key} onChange={(e) => setKey(e.target.value)} />
          <span className="muted small">{p.hint}</span>
        </div>
        <div className="field"><div className="btns"><button className="primary" onClick={save}>保存</button><button className="ghost" disabled={!ready(p)} onClick={test}>试一下</button><Msg m={m} /></div></div>
      </div>
      <p className="note">加密保存，只显示末 4 位</p>
    </>
  );
}

function ModelSelect({ label, value, usable, onChange }: { label: string; value: { provider: string; modelId: string }; usable: Provider[]; onChange: (v: { provider: string; modelId: string }) => void }) {
  const models = useModels(value.provider).data ?? [];
  useEffect(() => {
    if (models.length && !models.some((m) => m.id === value.modelId)) onChange({ ...value, modelId: models[0]!.id });
  }, [models]);
  return (
    <div className="field">
      <label>{label}</label>
      <div className="row2">
        <select value={value.provider} onChange={(e) => onChange({ provider: e.target.value, modelId: "" })}>{usable.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
        <select value={value.modelId} onChange={(e) => onChange({ ...value, modelId: e.target.value })}>{models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
      </div>
    </div>
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
      <div className="gtitle">服务商</div>
      <div className="group">
        {S.providers.map((p) => (
          <button key={p.id} className="item acct" data-a={`provider:${p.id}`} onClick={() => nav({ to: "/settings/models/$account", params: { account: `provider:${p.id}` } })}>
            <Mono label={p.label} /><span className="grow"><span className="aName">{p.label}</span><span className="aSub">{S.model.provider === p.id && ready(p) ? "正在用" : ""}</span></span>
            {ready(p) ? <span className="badge ok">已添加</span> : <span className="pillBtn">添加</span>}
          </button>
        ))}
      </div>
      <div className="gtitle">用哪个</div>
      {usable.length ? main && small && (
        <div className="group">
          <ModelSelect label="聊天" value={main} usable={usable} onChange={setMain} />
          <ModelSelect label="后台（整理记忆、更新面板）" value={small} usable={usable} onChange={setSmall} />
          <div className="field"><div className="btns"><button className="primary" onClick={save}>保存</button><Msg m={m} /></div></div>
        </div>
      ) : <p className="note">先添加一家服务商</p>}
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
      <div className="gtitle">绑定的账号</div>
      <div className="group">
        {S.owners.length ? S.owners.map((o) => (
          <div key={o} className="item"><span className="grow"><code>{o}</code></span>{env.has(o) ? <span className="badge">配置文件</span> : <button className="dangerBtn" onClick={async () => { await api(`/api/settings/owners/${enc(o)}`, { method: "DELETE" }); invalidate("settings"); }}>解绑</button>}</div>
        )) : <div className="item muted">还没有绑定</div>}
        <div className="field">
          <div className="btns"><button className="ghost" onClick={async () => setCode((await api("/api/settings/pair", { method: "POST" })).code)}>获取绑定码</button></div>
          {code && <div><div className="code">{code}</div><p className="note" style={{ margin: 0, textAlign: "center" }}>10 分钟内私聊机器人发送 <code>/pair {code}</code></p></div>}
        </div>
      </div>
      <p className="note">绑定后，只有你能私聊 Tomo</p>
      <div className="gtitle">登录密码</div>
      <div className="group">
        <div className="field"><label>当前密码</label><input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
        <div className="field"><label>新密码（至少 8 位）</label><input type="password" autoComplete="new-password" value={nxt} onChange={(e) => setNxt(e.target.value)} /></div>
        <div className="field"><div className="btns"><button className="primary" onClick={change}>修改</button><Msg m={m} /></div></div>
      </div>
      <p className="note">改完后，其他设备要重新登录</p>
    </>
  );
}

function AboutPage() {
  return (
    <>
      <div className="group">
        <div className="item"><Icon name="sparkles" /><span className="grow">Tomo</span><span className="val">你的私人助手</span></div>
        <a className="item" href="https://github.com/QinYangWang/tomo" target="_blank" rel="noopener"><span className="grow">源代码</span><Arrow /></a>
      </div>
      <p className="note">备份时，复制整个 data 文件夹</p>
    </>
  );
}
