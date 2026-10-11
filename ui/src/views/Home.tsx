// Home: greeting, the panels Tomo builds, and a few built-in glance cards.
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";
import { api } from "../api.ts";
import { Sheet } from "../components/Sheet.tsx";
import { Icon } from "../icons.tsx";
import { ago, CADENCE, greeting, md, when } from "../lib.ts";
import { invalidate, useMemories, usePanels, useSchedules, useSettings } from "../queries.ts";
import { confirmDialog, useShell } from "../store.tsx";
import type { Panel } from "../types.ts";
import { CH, dotCls, chHasToken } from "../settings/shared.ts";

const TINTS = ["t-mint", "t-marigold", "t-periwinkle", "t-blush"];

function PanelCard({ p, tint, onEdit }: { p: Panel; tint: string; onEdit: () => void }) {
  const act = async (a: string) => {
    if (a === "refresh") await api(`/api/panels/${p.id}/refresh`, { method: "POST" });
    if (a === "edit") return onEdit();
    if (a === "remove") {
      if (!(await confirmDialog({ title: `移除「${p.title}」？`, body: "面板会从 Home 消失，Tomo 也不再刷新它。", confirm: "移除", danger: true }))) return;
      await api(`/api/panels/${p.id}`, { method: "DELETE" });
    }
    invalidate("panels");
  };
  const head = (
    <div className="ph">
      <span className={`tint ${tint}`}><Icon name="dashboard" size={18} /></span>
      <h3>{p.title}</h3>
      {p.status !== "building" && (
        <MenuTrigger>
          <Button className="icon sm pmenu" aria-label="更多"><Icon name="more" size={18} /></Button>
          <Popover className="pop" placement="bottom end">
            <Menu onAction={(k) => act(String(k))}>
              <MenuItem id="refresh" className="mi"><Icon name="refresh" size={16} />现在刷新</MenuItem>
              <MenuItem id="edit" className="mi"><Icon name="edit" size={16} />让 Tomo 修改</MenuItem>
              <MenuItem id="remove" className="mi danger"><Icon name="trash" size={16} />从 Home 移除</MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
      )}
    </div>
  );
  if (p.status === "building")
    return (
      <div className="panel">
        {head}
        {p.body ? <div className="pbody" style={{ opacity: 0.45 }} dangerouslySetInnerHTML={{ __html: md(p.body) }} /> : <div className="skeleton"><i /><i /><i /></div>}
        <div className="pf"><Icon name="loading" size={14} />Tomo 正在{p.body ? "刷新" : "制作"}…</div>
      </div>
    );
  if (p.status === "error" && !p.body)
    return (
      <div className="panel">
        {head}
        <div className="line err">没做成：{p.error}</div>
        <div className="pf"><button className="ghost" onClick={() => act("refresh")}>重试</button></div>
      </div>
    );
  return (
    <div className="panel">
      {head}
      <div className="pbody" dangerouslySetInnerHTML={{ __html: md(p.body) }} />
      <div className="pf">{p.status === "error" && <span className="err">刷新失败 · </span>}更新于 {ago(p.updated_at)} · {CADENCE[p.cadence] ?? ""}</div>
    </div>
  );
}

function EditPanel({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [v, setV] = useState("");
  const go = async () => {
    if (!v.trim()) return;
    await api(`/api/panels/${id}`, { method: "PUT", body: { instruction: v.trim() } });
    setV("");
    onClose();
    setTimeout(() => invalidate("panels"), 400);
  };
  return (
    <Sheet open={!!id} onClose={onClose} title="修改面板" small>
      <textarea className="bigInput" autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder="比如：只显示前 3 条；改成每天早上刷新；加上涨跌幅" />
      <div className="btns" style={{ marginTop: 12, justifyContent: "flex-end" }}><button className="primary" onClick={go}>让 Tomo 修改</button></div>
    </Sheet>
  );
}

const EXAMPLES = ["比特币和以太坊的价格", "东京这周的天气", "我这周的定时任务和待办", "Hacker News 头条前五", "GitHub 上 tomo 仓库的最新提交"];
export function NewPanelSheet() {
  const { newPanel, setNewPanel } = useShell();
  const [v, setV] = useState("");
  const [err, setErr] = useState("");
  const nav = useNavigate();
  const go = async () => {
    if (!v.trim()) return;
    const r = await api("/api/panels", { method: "POST", body: { request: v.trim() } });
    if (r.error) return setErr(r.error);
    setV("");
    setNewPanel(false);
    invalidate("panels");
    nav({ to: "/" });
  };
  return (
    <Sheet open={newPanel} onClose={() => setNewPanel(false)} title="新建面板" small>
      <p className="muted" style={{ margin: "0 2px 12px" }}>想在 Home 上一眼看到什么？Tomo 会去找数据、做成卡片，并按合适的频率自动刷新。</p>
      <textarea className="bigInput" id="np" autoFocus value={v} placeholder="比如：比特币和以太坊的价格" onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && go()} />
      <div className="examples">{EXAMPLES.map((x) => <button key={x} onClick={() => setV(x)}>{x}</button>)}</div>
      <div className="btns" style={{ marginTop: 14, justifyContent: "flex-end" }}>
        {err && <span className="msg err">{err}</span>}
        <button className="primary" onClick={go}>创建</button>
      </div>
    </Sheet>
  );
}

export function HomeView() {
  const S = useSettings().data;
  const sch = useSchedules().data ?? [];
  const mem = useMemories().data ?? [];
  const ps = usePanels().data ?? [];
  const nav = useNavigate();
  const { setNewPanel } = useShell();
  const [editing, setEditing] = useState<string | null>(null);
  const who = S?.profile?.nickname || S?.profile?.name;
  const toSettings = (page: string) => nav({ to: "/settings/$page", params: { page } });
  const next = sch[0];
  return (
    <div className="page">
      <p className="eyebrow">{new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })}</p>
      <h1 className="hello serif">{greeting()}{who ? `，${who}` : ""}</h1>
      <div className="panels" id="panels">
        {ps.map((p, i) => <PanelCard key={p.id} p={p} tint={TINTS[i % TINTS.length]!} onEdit={() => setEditing(p.id)} />)}
        <div className="panel click" onClick={() => toSettings("schedules")}>
          <div className="ph"><span className="tint t-linen"><Icon name="clock" size={18} /></span><h3>接下来</h3></div>
          {next?.next_run ? (
            <><div className="big">{when(next.next_run)}</div><div className="line">{next.title}</div><div className="pf">共 {sch.length} 个定时任务</div></>
          ) : (
            <><div className="line muted">没有定时任务</div><div className="pf">在对话里说「每天早上 8 点提醒我…」</div></>
          )}
        </div>
        <div className="panel click" onClick={() => toSettings("memory")}>
          <div className="ph"><span className="tint t-linen"><Icon name="brain" size={18} /></span><h3>最近记住的</h3></div>
          {mem.length ? (
            <>{mem.slice(0, 3).map((m) => <div key={m.id} className="line">{m.content}</div>)}<div className="pf">共 {mem.length} 条 · 最近 {ago(mem[0]!.updated_at)}</div></>
          ) : <div className="line muted">还没有记忆。聊得越多，Tomo 越懂你。</div>}
        </div>
        {S && (
          <div className="panel click" onClick={() => toSettings("accounts")}>
            <div className="ph"><span className="tint t-linen"><Icon name="plug" size={18} /></span><h3>连接</h3></div>
            <div className="chips">
              {S.channels.map((c) => (
                <span key={c.id} className="chip"><Icon name={c.id} size={14} />{CH[c.id].label}<span className={`dot ${c.enabled && chHasToken(c) ? dotCls(c.status.state) : ""}`} /></span>
              ))}
            </div>
            <div className="pf"><Icon name="ai" size={14} />{S.model.modelId}</div>
          </div>
        )}
        {!ps.length && (
          <div className="panel click" style={{ border: "1.5px dashed var(--ash)", boxShadow: "none", background: "none" }} onClick={() => setNewPanel(true)}>
            <div className="ph"><span className="tint t-linen"><Icon name="add" size={18} /></span><h3>新建面板</h3></div>
            <div className="line muted">告诉 Tomo 想在这里看到什么：比特币价格、这周的待办、某个网站的更新…</div>
          </div>
        )}
      </div>
      <EditPanel id={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
