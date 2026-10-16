// 首页: a greeting and the panels Tomo builds. Nothing else.
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { EditIcon, GridIcon, MoreHorizontalIcon, PlusIcon, RefreshIcon, TrashIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/ui/card";
import { EmptyState, EmptyStateActions, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "@/ui/empty-state";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/ui/menu";
import { Skeleton } from "@/ui/skeleton";
import { ResponseMarkdown } from "@/ui/streaming-response";
import { TextShimmer } from "@/ui/text-shimmer";
import { Textarea } from "@/ui/textarea";
import { api } from "../api.ts";
import { Msg, Page, Sheet, ToolbarButton } from "../components/parts.tsx";
import { TopBar } from "../components/TopBar.tsx";
import { ago, CADENCE, greeting } from "../lib.ts";
import { invalidate, usePanels, useSettings } from "../queries.ts";
import { confirmDialog, useShell } from "../store.tsx";
import type { Panel } from "../types.ts";

const span = (p: Panel) => ((p as { size?: string }).size === "wide" ? "sm:col-span-2" : (p as { size?: string }).size === "full" ? "sm:col-span-2 lg:col-span-3" : "");

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
  const building = p.status === "building";
  return (
    <Card data-panel={p.id} data-status={p.status} className={cn("min-h-44", span(p))}>
      <CardHeader>
        <CardTitle className="truncate">{p.title}</CardTitle>
        {!building && (
          <CardAction>
            <Menu>
              <MenuTrigger render={<Button type="button" variant="ghost" size="icon-xs" aria-label="更多" />}><MoreHorizontalIcon /></MenuTrigger>
              <MenuContent align="end">
                <MenuItem onClick={() => act("refresh")}><RefreshIcon />更新</MenuItem>
                <MenuItem onClick={() => act("edit")}><EditIcon />修改</MenuItem>
                <MenuSeparator />
                <MenuItem variant="destructive" onClick={() => act("remove")}><TrashIcon />删除</MenuItem>
              </MenuContent>
            </Menu>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex-1">
        {building && !p.body ? (
          <div className="flex flex-col gap-2.5">{["w-3/5", "w-11/12", "w-3/4"].map((w) => <Skeleton key={w} className={cn("h-3", w)} />)}</div>
        ) : p.status === "error" && !p.body ? (
          <p className="text-ui text-destructive">没做成</p>
        ) : (
          <div className={building ? "opacity-64" : undefined}><ResponseMarkdown text={p.body} /></div>
        )}
      </CardContent>
      <CardFooter>
        {p.status === "error" && !p.body && !building ? <Button variant="secondary" size="sm" onClick={() => act("refresh")}>重试</Button> : (
          <span className="text-ui-sm text-muted-foreground">
            {building ? <TextShimmer>{`正在${p.body ? "更新" : "制作"}…`}</TextShimmer>
              : <>{p.status === "error" && <span className="text-destructive">更新失败 · </span>}{ago(p.updated_at)} · {CADENCE[p.cadence] ?? ""}</>}
          </span>
        )}
      </CardFooter>
    </Card>
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
      <Textarea autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder="如：只显示前 3 条" aria-label="怎么改" />
      <div className="flex justify-end"><Button onClick={go}>修改</Button></div>
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
      <p className="text-ui text-muted-foreground">想看什么？Tomo 做好后会自动更新</p>
      <Textarea id="np" autoFocus value={v} placeholder="如：比特币价格" aria-label="想看什么" onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && go()} />
      <div className="flex flex-wrap gap-2">{EXAMPLES.map((x) => <Button key={x} variant="secondary" size="sm" onClick={() => setV(x)}>{x}</Button>)}</div>
      <div className="flex items-center justify-end gap-3">
        <Msg m={err ? { text: err, ok: false } : null} />
        <Button id="npGo" onClick={go}>创建</Button>
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
        <ToolbarButton id="newPanelBtn" label="新建面板" onClick={() => setNewPanel(true)}><PlusIcon /></ToolbarButton>
      </TopBar>
      <Page>
        <h1 className="hello text-3xl font-semibold tracking-tight text-balance">{greeting()}{who ? `，${who}` : ""}</h1>
        {ps && (ps.length ? (
          <div id="panels" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{ps.map((p) => <PanelCard key={p.id} p={p} onEdit={() => setEditing(p.id)} />)}</div>
        ) : (
          <EmptyState variant="outline" size="lg">
            <EmptyStateIcon><GridIcon /></EmptyStateIcon>
            <EmptyStateTitle>还没有面板</EmptyStateTitle>
            <EmptyStateDescription>想天天看的，做成面板放这里</EmptyStateDescription>
            <EmptyStateActions><Button onClick={() => setNewPanel(true)}>新建面板</Button></EmptyStateActions>
          </EmptyState>
        ))}
        <EditPanel id={editing} onClose={() => setEditing(null)} />
      </Page>
    </>
  );
}
