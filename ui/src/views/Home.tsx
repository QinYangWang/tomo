// 首页: a greeting and the panels Tomo builds. Nothing else.
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "../api.ts";
import { ActionMenu, Btn, IconBtn } from "../components/kit.tsx";
import { Sheet } from "../components/Sheet.tsx";
import { TextShimmer } from "@/components/motion/text-shimmer";
import { TopBar } from "../components/TopBar.tsx";
import { Icon } from "../icons.tsx";
import { ago, CADENCE, greeting, md } from "../lib.ts";
import { Empty, Md, Page } from "../components/ui.tsx";
import { cn } from "@/lib/utils";
import { invalidate, usePanels, useSettings } from "../queries.ts";
import { confirmDialog, useShell } from "../store.tsx";
import type { Panel } from "../types.ts";

const CARD = "panel relative flex min-h-44 flex-col gap-3 rounded-3xl border border-border bg-card p-5";
const wide = (p: Panel) => ((p as { size?: string }).size === "wide" ? "sm:col-span-2" : (p as { size?: string }).size === "full" ? "sm:col-span-2 lg:col-span-3 min-h-0" : "");

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
    <div className="ph flex items-center gap-2">
      <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{p.title}</h3>
      {p.status !== "building" && (
        <ActionMenu
          trigger={<IconBtn className="sm pmenu" icon="more" label="更多" tip={false} />}
          onAction={act}
          items={[
            { id: "refresh", label: "更新", icon: "refresh" },
            { id: "edit", label: "修改", icon: "edit" },
            { id: "remove", label: "删除", icon: "trash", danger: true },
          ]}
        />
      )}
    </div>
  );
  if (p.status === "building")
    return (
      <div className={cn(CARD, wide(p))}>
        {head}
        {p.body ? <Md className="pbody flex-1 text-sm opacity-45" html={md(p.body)} /> : <div className="skeleton flex flex-1 flex-col gap-2.5">{[60, 90, 75].map((w) => <i key={w} className="h-3 animate-pulse rounded-full bg-foreground/[0.07]" style={{ width: `${w}%` }} />)}</div>}
        <div className="pf text-xs text-muted-foreground"><TextShimmer>{`正在${p.body ? "更新" : "制作"}…`}</TextShimmer></div>
      </div>
    );
  if (p.status === "error" && !p.body)
    return (
      <div className={cn(CARD, wide(p))}>
        {head}
        <div className="line err flex-1 text-sm text-destructive">没做成</div>
        <div className="pf"><Btn kind="secondary" size="sm" onClick={() => act("refresh")}>重试</Btn></div>
      </div>
    );
  return (
    <div className={cn(CARD, wide(p))}>
      {head}
      <Md className="pbody flex-1 text-sm leading-6" html={md(p.body)} />
      <div className="pf text-xs text-muted-foreground">{p.status === "error" && <span className="err text-destructive">更新失败 · </span>}{ago(p.updated_at)} · {CADENCE[p.cadence] ?? ""}</div>
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
      <textarea className="bigInput min-h-28 w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-[15px] outline-none transition focus:border-foreground/25 focus:ring-2 focus:ring-ring" autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder="如：只显示前 3 条" />
      <div className="btns mt-3 flex justify-end"><Btn onClick={go}>修改</Btn></div>
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
      <p className="mb-3 px-0.5 text-sm text-muted-foreground">想看什么？Tomo 做好后会自动更新</p>
      <textarea className="bigInput min-h-28 w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-[15px] outline-none transition focus:border-foreground/25 focus:ring-2 focus:ring-ring" id="np" autoFocus value={v} placeholder="如：比特币价格" onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && go()} />
      <div className="examples mt-3 flex flex-wrap gap-2">{EXAMPLES.map((x) => <Btn key={x} kind="secondary" size="sm" onClick={() => setV(x)}>{x}</Btn>)}</div>
      <div className="btns mt-4 flex items-center justify-end gap-3">
        {err && <span className="msg err text-xs text-destructive">{err}</span>}
        <Btn onClick={go}>创建</Btn>
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
        <IconBtn id="newPanelBtn" icon="add" label="新建面板" onClick={() => setNewPanel(true)} />
      </TopBar>
      <Page>
        <h1 className="hello mb-8 text-4xl font-semibold tracking-tight text-balance desk:text-5xl">{greeting()}{who ? `，${who}` : ""}</h1>
        {ps && (ps.length ? (
          <div className="panels grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" id="panels">{ps.map((p) => <PanelCard key={p.id} p={p} onEdit={() => setEditing(p.id)} />)}</div>
        ) : (
          <Empty icon="dashboard" title="还没有面板" sub="想天天看的，做成面板放这里"><Btn className="mt-3" onClick={() => setNewPanel(true)}>新建面板</Btn></Empty>
        ))}
        <EditPanel id={editing} onClose={() => setEditing(null)} />
      </Page>
    </>
  );
}
