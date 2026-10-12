// 首页: a greeting and the panels Tomo builds. Nothing else.
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";
import { api } from "../api.ts";
import { Sheet } from "../components/Sheet.tsx";
import { TopBar } from "../components/TopBar.tsx";
import { Icon } from "../icons.tsx";
import { ago, CADENCE, greeting, md } from "../lib.ts";
import { invalidate, usePanels, useSettings } from "../queries.ts";
import { confirmDialog, useShell } from "../store.tsx";
import type { Panel } from "../types.ts";

function PanelCard({ p, onEdit }: { p: Panel; onEdit: () => void }) {
  const act = async (a: string) => {
    if (a === "refresh") await api(`/api/panels/${p.id}/refresh`, { method: "POST" });
    if (a === "edit") return onEdit();
    if (a === "remove") {
      if (!(await confirmDialog({ title: `删除「${p.title}」？`, body: "删除后不再更新", confirm: "删除", danger: true }))) return;
      await api(`/api/panels/${p.id}`, { method: "DELETE" });
    }
    invalidate("panels");
  };
  const head = (
    <div className="ph">
      <h3>{p.title}</h3>
      {p.status !== "building" && (
        <MenuTrigger>
          <Button className="icon sm pmenu" aria-label="更多"><Icon name="more" size={18} /></Button>
          <Popover className="pop" placement="bottom end">
            <Menu onAction={(k) => act(String(k))}>
              <MenuItem id="refresh" className="mi"><Icon name="refresh" size={16} />更新</MenuItem>
              <MenuItem id="edit" className="mi"><Icon name="edit" size={16} />修改</MenuItem>
              <MenuItem id="remove" className="mi danger"><Icon name="trash" size={16} />删除</MenuItem>
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
        <div className="pf"><Icon name="loading" size={14} />正在{p.body ? "更新" : "制作"}…</div>
      </div>
    );
  if (p.status === "error" && !p.body)
    return (
      <div className="panel">
        {head}
        <div className="line err">没做成</div>
        <div className="pf"><button className="ghost" onClick={() => act("refresh")}>重试</button></div>
      </div>
    );
  return (
    <div className="panel">
      {head}
      <div className="pbody" dangerouslySetInnerHTML={{ __html: md(p.body) }} />
      <div className="pf">{p.status === "error" && <span className="err">更新失败 · </span>}{ago(p.updated_at)} · {CADENCE[p.cadence] ?? ""}</div>
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
      <textarea className="bigInput" autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder="如：只显示前 3 条" />
      <div className="btns" style={{ marginTop: 12, justifyContent: "flex-end" }}><button className="primary" onClick={go}>修改</button></div>
    </Sheet>
  );
}

const EXAMPLES = ["比特币价格", "东京天气", "Hacker News 头条", "今日汇率"];
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
      <p className="muted" style={{ margin: "0 2px 12px" }}>想看什么？Tomo 做好后会自动更新</p>
      <textarea className="bigInput" id="np" autoFocus value={v} placeholder="如：比特币价格" onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && go()} />
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
  const ps = usePanels().data;
  const { setNewPanel } = useShell();
  const [editing, setEditing] = useState<string | null>(null);
  const who = S?.profile?.nickname || S?.profile?.name;
  return (
    <>
      <TopBar title="首页">
        <Button className="icon" id="newPanelBtn" aria-label="新建面板" data-tip="新建面板" onPress={() => setNewPanel(true)}><Icon name="add" size={18} /></Button>
      </TopBar>
      <div className="scroll">
        <div className="page">
          <h1 className="hello serif">{greeting()}{who ? `，${who}` : ""}</h1>
          {ps && (ps.length ? (
            <div className="panels" id="panels">{ps.map((p) => <PanelCard key={p.id} p={p} onEdit={() => setEditing(p.id)} />)}</div>
          ) : (
            <div className="toolEmpty">
              <Icon name="dashboard" size={28} /><b>还没有面板</b><span>想天天看的，做成面板放这里</span>
              <button className="primary" onClick={() => setNewPanel(true)}>新建面板</button>
            </div>
          ))}
          <EditPanel id={editing} onClose={() => setEditing(null)} />
        </div>
      </div>
    </>
  );
}
