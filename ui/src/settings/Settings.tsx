// Settings is a page: root list → sub-pages. The top-left bar button walks back up.
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { api, enc, session } from "../api.ts";
import { Icon } from "../icons.tsx";
import { ago, when } from "../lib.ts";
import { invalidate, useMemories, useModels, useSchedules, useSettings, useSkills } from "../queries.ts";
import { confirmDialog, toast } from "../store.tsx";
import type { Channel, Provider, Settings } from "../types.ts";
import { CH, chHasToken, chState, dotCls, GROUPS, PAGES, ready, testProvider, useProviderAsDefault } from "./shared.ts";

type Flash = { text: string; ok: boolean } | null;
const Msg = ({ m }: { m: Flash }) => (m ? <span className={`msg ${m.ok ? "ok" : "err"}`}>{m.text}</span> : null);
const Arrow = () => <span className="arrow"><Icon name="right" size={16} /></span>;

export function SettingsRoot() {
  const S = useSettings().data;
  const mem = useMemories().data ?? [];
  const nav = useNavigate();
  if (!S) return null;
  const P = S.profile ?? {};
  const who = P.nickname || P.name || "";
  const key = S.providers.some(ready);
  const n = S.channels.filter((c) => c.enabled && c.status.state === "connected").length + S.providers.filter(ready).length;
  const vals: Record<string, string> = { profile: who ? "" : "未填写", accounts: n ? `${n} 个` : "未连接", models: key ? S.model.modelId : "未设置", memory: mem.length ? `${mem.length} 条` : "" };
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    session.set("");
    location.reload();
  };
  return (
    <>
      <Link className="setHead" to="/settings/$page" params={{ page: "profile" }}>
        <span className="avatar">{who ? [...who][0]!.toUpperCase() : <Icon name="user" size={26} />}</span>
        <span className="grow">
          <span className="setName serif">{who || "你好"}</span>
          <span className="setSub">{P.email || (who ? P.work || "" : "填写资料，让 Tomo 更懂你")}</span>
        </span>
      </Link>
      <Link className="statCard" to="/settings/$page" params={{ page: key ? "models" : "accounts" }}>
        <span className="statTop">
          <span className="serif">Tomo</span>
          <span className="statModel">{key ? <><Icon name="ai" size={14} /><span className="ell">{S.model.modelId}</span></> : "还没接上 AI 模型"}</span>
        </span>
        <span className="statChips">
          {S.channels.map((c) => {
            const on = c.enabled && chHasToken(c);
            return <span key={c.id} className={`chip ${on ? "" : "dim"}`}><Icon name={c.id} size={14} />{CH[c.id].label}<span className={`dot ${on ? dotCls(c.status.state) : ""}`} /></span>;
          })}
        </span>
      </Link>
      {GROUPS.map((g, i) => (
        <div key={i} className="group">
          {g.map((k) => (
            <button key={k} className="item" data-k={k} onClick={() => nav({ to: "/settings/$page", params: { page: k } })}>
              <Icon name={PAGES[k]![1]} /><span className="grow">{PAGES[k]![0]}</span><span className="val">{vals[k] ?? ""}</span><Arrow />
            </button>
          ))}
        </div>
      ))}
      <div className="group logoutRow"><button className="item" onClick={logout}><Icon name="logout" /><span className="grow">退出登录</span></button></div>
    </>
  );
}

export function SettingsPage({ page, children }: { page: string; children?: ReactNode }) {
  const body: Record<string, () => ReactNode> = { profile: () => <ProfilePage />, schedules: () => <SchedulesPage />, accounts: () => <AccountsPage />, models: () => <ModelsPage />, memory: () => <MemoryPage />, skills: () => <SkillsPage />, security: () => <SecurityPage />, about: () => <AboutPage /> };
  return (
    <>
      <h1 className="setTitle serif">{PAGES[page]?.[0] ?? ""}</h1>
      <div className="setBody">{children ?? body[page]?.()}</div>
    </>
  );
}

const PROFILE: [string, string, string][][] = [
  [["name", "姓名", "你的名字"], ["nickname", "昵称", "Tomo 应该怎么称呼你？"], ["birthday", "生日", "例如：1999-01-03"]],
  [["email", "邮箱", "you@example.com"], ["phone", "电话", "+86 138 0000 0000"], ["home", "住址", "城市或详细地址"], ["work", "工作", "职位 · 公司"]],
  [["household", "家庭", "例如：伴侣，2 个孩子"], ["interests", "兴趣", "例如：设计、木工"], ["pets", "宠物", "例如：叫 Max 的狗"]],
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
      <p className="note">Tomo 每次回答都会参考这些信息。只保存在你自己的服务器上。</p>
    </>
  );
}

function SchedulesPage() {
  const list = useSchedules().data;
  if (!list) return null;
  if (!list.length) return <div className="empty">没有定时任务。<br />在对话里说「每个工作日早上 8 点给我发今天的安排」。</div>;
  const KIND: Record<string, string> = { once: "一次", interval: "间隔", daily: "每天", cron: "cron" };
  return (
    <div className="group">
      {list.map((s) => (
        <div key={s.id} className="item">
          <span className="grow">{s.title}<div className="muted small">{s.next_run ? when(s.next_run) : "已结束"} · {KIND[s.kind] ?? s.kind} {s.spec}</div></span>
          <button className="dangerBtn" onClick={async () => { await api(`/api/schedules/${enc(s.id)}`, { method: "DELETE" }); toast("已取消"); invalidate("schedules"); }}>取消</button>
        </div>
      ))}
    </div>
  );
}

// ---- 账户: platforms and AI providers in one list; each row opens its own page ----
const Mono = ({ label }: { label: string }) => <span className="logo mono">{label[0]}</span>;
export function AccountsPage() {
  const S = useSettings().data;
  const nav = useNavigate();
  const [tab, setTab] = useState(() => sessionStorage.acctTab || "all");
  useEffect(() => void (sessionStorage.acctTab = tab), [tab]);
  if (!S) return null;
  const open = (account: string) => nav({ to: "/settings/accounts/$account", params: { account } });
  const rows = [
    ...S.channels.map((c) => {
      const [st, cls] = chState(c);
      return { tab: "channels", id: `channel:${c.id}`, label: CH[c.id].label, logo: <span className="logo"><Icon name={c.id} /></span>, sub: "消息平台 · 私聊和群聊", right: chHasToken(c) ? <span className={`badge ${cls}`}>{st}</span> : <span className="pillBtn">连接</span> };
    }),
    ...S.providers.map((p) => ({
      tab: "providers", id: `provider:${p.id}`, label: p.label, logo: <Mono label={p.label} />,
      sub: S.model.provider === p.id && ready(p) ? "AI 模型 · 当前主模型" : "AI 模型",
      right: p.key.set ? <span className="badge ok">····{p.key.last4}</span> : p.fromEnv ? <span className="badge">环境变量</span> : <span className="pillBtn">添加</span>,
    })),
  ];
  return (
    <>
      <div className="seg" role="tablist">
        {[["all", "全部"], ["channels", "消息平台"], ["providers", "AI 模型"]].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} data-t={k} onClick={() => setTab(k!)}>{l}</button>
        ))}
      </div>
      <div className="group">
        {rows.filter((r) => tab === "all" || r.tab === tab).map((r) => (
          <button key={r.id} className="item acct" data-a={r.id} onClick={() => open(r.id)}>
            {r.logo}<span className="grow"><span className="aName">{r.label}</span><span className="aSub">{r.sub}</span></span>{r.right}
          </button>
        ))}
      </div>
    </>
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
      <div className="setBody">{c ? <ChannelForm c={c} /> : p ? <ProviderForm p={p} S={S} /> : <div className="empty">没有这个账户</div>}</div>
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
    setM({ text: "连接中…", ok: true });
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
          <span className="grow">状态 <span className={`badge ${cls}`}>{st}</span></span>
          {has && <input type="checkbox" className={`toggle ${on && c.status.state !== "connected" ? "pending" : ""}`} checked={on} aria-label={`启用 ${meta.label}`} onChange={(e) => save(e.target.checked, false)} />}
        </div>
        {Object.entries(meta.fields).map(([f, label]) => {
          const v = c.fields[f] ?? { set: false }, now = v.last4 ? `已保存 ····${v.last4}` : v.fromEnv ? "来自环境变量" : "";
          return (
            <div key={f} className="field">
              <label>{label} {now && <span className="badge">{now}</span>}</label>
              <input type="password" autoComplete="off" placeholder={now ? "留空则不修改" : "粘贴 token"} value={vals[f] ?? ""} onChange={(e) => setVals({ ...vals, [f]: e.target.value })} />
            </div>
          );
        })}
        <div className="field"><div className="btns"><button className="primary" disabled={busy} onClick={() => save(true, true)}>保存并连接</button><Msg m={m} /></div></div>
      </div>
      <div className="gtitle">怎么拿 token</div>
      <div className="group"><div className="field"><ol className="steps">{meta.steps.map((s) => <li key={s}>{s}</li>)}</ol></div></div>
      <p className="note">保存后立刻连接，不用重启。连上后去「安全」配对你的聊天账号。</p>
    </>
  );
}

function ProviderForm({ p, S }: { p: Provider; S: Settings }) {
  const [key, setKey] = useState("");
  const [m, setM] = useState<Flash>(null);
  const nav = useNavigate();
  const test = async () => {
    setM({ text: "测试中…", ok: true });
    const r = await testProvider(p.id);
    setM(r.ok ? { text: `可以用 ✓ ${r.model}`, ok: true } : { text: r.error ?? "失败", ok: false });
  };
  const save = async () => {
    if (!key.trim()) return setM({ text: "先填 key", ok: false });
    const r = await api(`/api/settings/providers/${p.id}`, { method: "PUT", body: { key } });
    if (r.error) return setM({ text: r.error, ok: false });
    setKey("");
    // The first key ever becomes the default, so Tomo works right away.
    if (!S.providers.some(ready)) await useProviderAsDefault(p.id);
    await invalidate("settings");
    await test();
  };
  const del = async () => {
    if (!(await confirmDialog({ title: `删除 ${p.label} 的 key？`, body: "用这家模型的对话会停止工作，直到你换一家。", confirm: "删除", danger: true }))) return;
    await api(`/api/settings/providers/${p.id}`, { method: "DELETE" });
    invalidate("settings");
  };
  return (
    <>
      <div className="group">
        <div className="item">
          <Mono label={p.label} />
          <span className="grow">状态 {p.key.set ? <span className="badge ok">····{p.key.last4}</span> : p.fromEnv ? <span className="badge">环境变量</span> : <span className="badge">未设置</span>}</span>
          {p.key.set && <button className="dangerBtn" onClick={del}>删除</button>}
        </div>
        <div className="field">
          <label>API key</label>
          <input type="password" autoComplete="off" placeholder={p.key.set ? "输入新 key 替换" : "粘贴 API key"} value={key} onChange={(e) => setKey(e.target.value)} />
          <span className="muted small">{p.hint}</span>
        </div>
        <div className="field"><div className="btns"><button className="primary" onClick={save}>保存</button><button className="ghost" disabled={!ready(p)} onClick={test}>测试</button><Msg m={m} /></div></div>
      </div>
      <p className="note">key 加密保存在你的服务器上，这里只显示末四位。默认用哪个模型，在<a className="inlineLink" onClick={() => nav({ to: "/settings/$page", params: { page: "models" } })}>「AI 模型」</a>里选。</p>
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
  if (!usable.length)
    return (
      <div className="empty">还没有可用的模型。<br />先在「账户」里添加一家 AI 供应商的 key。
        <div className="btns" style={{ justifyContent: "center", marginTop: 14 }}><button className="primary" onClick={() => (sessionStorage.acctTab = "providers", nav({ to: "/settings/$page", params: { page: "accounts" } }))}>添加 key</button></div>
      </div>
    );
  if (!main || !small) return null;
  const save = async () => {
    const r = await api("/api/settings/model", { method: "PUT", body: { model: main, smallModel: small } });
    if (r.error) return setM({ text: r.error, ok: false });
    setM({ text: "已保存", ok: true });
    toast(`主模型：${r.model.modelId}`);
    invalidate("settings");
  };
  return (
    <>
      <div className="group">
        <ModelSelect label="主模型 · 对话" value={main} usable={usable} onChange={setMain} />
        <ModelSelect label="小模型 · 后台反思、子任务和面板刷新" value={small} usable={usable} onChange={setSmall} />
        <div className="field"><div className="btns"><button className="primary" onClick={save}>保存</button><Msg m={m} /></div></div>
      </div>
      <p className="note">只列出已经填了 key 的供应商。要加别家，去「账户」。</p>
    </>
  );
}

function MemoryPage() {
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);
  const list = useMemories(dq).data;
  return (
    <>
      <input className="searchBox" placeholder="搜索记忆" value={q} onChange={(e) => setQ(e.target.value)} />
      {list && (list.length ? (
        <div className="group">
          {list.map((m) => (
            <div key={m.id} className="item">
              <span className="grow">{m.content}<div className="muted small">{m.subject} · {m.confidence === "inferred" ? "推断" : "你说的"} · {ago(m.updated_at)}</div></span>
              <button className="dangerBtn" onClick={async () => { await api(`/api/memories/${m.id}`, { method: "DELETE" }); toast("已忘掉"); invalidate("memories"); }}>忘掉</button>
            </div>
          ))}
        </div>
      ) : <div className="empty">{dq ? "没有匹配的记忆" : "还没有记忆"}</div>)}
    </>
  );
}

function SkillsPage() {
  const sk = useSkills().data;
  if (!sk) return null;
  return sk.length ? (
    <><div className="group">{sk.map((s) => <div key={s.name} className="item"><span className="grow"><strong>{s.name}</strong><div className="muted small">{s.description}</div></span></div>)}</div><p className="note">技能由 Tomo 在工作中自己写和改进。</p></>
  ) : <div className="empty">还没有技能。<br />Tomo 会把反复做的事沉淀成技能。</div>;
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
        toast("配对成功");
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
      setM({ text: "已修改", ok: true });
      setCur("");
      setNxt("");
    } else setM({ text: r.error === "wrong password" ? "当前密码不对" : r.error, ok: false });
  };
  return (
    <>
      <div className="gtitle">配对的聊天账号</div>
      <div className="group">
        {S.owners.length ? S.owners.map((o) => (
          <div key={o} className="item"><span className="grow"><code>{o}</code></span>{env.has(o) ? <span className="badge">环境变量</span> : <button className="dangerBtn" onClick={async () => { await api(`/api/settings/owners/${enc(o)}`, { method: "DELETE" }); invalidate("settings"); }}>移除</button>}</div>
        )) : <div className="item muted">还没有配对的账号</div>}
        <div className="field">
          <div className="btns"><button className="ghost" onClick={async () => setCode((await api("/api/settings/pair", { method: "POST" })).code)}>生成配对码</button></div>
          {code && <div><div className="code">{code}</div><p className="note" style={{ margin: 0, textAlign: "center" }}>10 分钟内，用你的账号私聊机器人发送 <code>/pair {code}</code></p></div>}
        </div>
      </div>
      <p className="note">配对后，你在各平台私聊 Tomo 都会进同一个 Home 对话；别人的私聊会被忽略。</p>
      <div className="gtitle">网页登录密码</div>
      <div className="group">
        <div className="field"><label>当前密码</label><input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
        <div className="field"><label>新密码（至少 8 位）</label><input type="password" autoComplete="new-password" value={nxt} onChange={(e) => setNxt(e.target.value)} /></div>
        <div className="field"><div className="btns"><button className="primary" onClick={change}>修改密码</button><Msg m={m} /></div></div>
      </div>
      <p className="note">修改后，其他设备需要重新登录。</p>
    </>
  );
}

function AboutPage() {
  return (
    <>
      <div className="group">
        <div className="item"><Icon name="sparkles" /><span className="grow">Tomo</span><span className="val">个人 agent · Pi Durable + Bun</span></div>
        <a className="item" href="https://github.com/QinYangWang/tomo" target="_blank" rel="noopener"><span className="grow">源代码</span><Arrow /></a>
      </div>
      <p className="note">数据全部在你自己的服务器上：data/ 目录。备份时连同 secret.key 一起。</p>
    </>
  );
}
