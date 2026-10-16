// Projects: each one is its own thread with its own memory. The sidebar lists them; the top bar names the open one.
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CopyIcon, FolderIcon, InfoIcon, MoreHorizontalIcon, SearchIcon } from "@/components/icons";
import { Button } from "@/ui/button";
import { EmptyState, EmptyStateActions, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "@/ui/empty-state";
import { Input } from "@/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/ui/menu";
import { SettingsRow, SettingsRowDescription, SettingsRowText, SettingsRowTitle } from "@/ui/settings-section";
import { ResponseMarkdown } from "@/ui/streaming-response";
import { api, enc } from "../api.ts";
import { ChatPane } from "../components/ChatPane.tsx";
import { Section, Sheet, ToolbarButton } from "../components/parts.tsx";
import { TopBar } from "../components/TopBar.tsx";
import { ago, briefLine, pname, UNTITLED } from "../lib.ts";
import { invalidate, qc, useMemories, useProject, useProjects } from "../queries.ts";
import { confirmDialog, toast, useShell } from "../store.tsx";
import type { Project } from "../types.ts";

const focusComposer = () => setTimeout(() => document.querySelector<HTMLTextAreaElement>("#composer textarea")?.focus(), 250);

export function useNewProject() {
  const nav = useNavigate();
  return async () => {
    const p = await api<Project>("/api/projects", { method: "POST", body: {} });
    if ((p as any).error) return;
    await invalidate("projects");
    nav({ to: "/projects/$id", params: { id: p.id } });
    focusComposer();
  };
}

/** Rename · archive/restore · delete. Renaming happens in the open project's top bar. */
export function useProjectActions(p: Project) {
  const { setRenaming } = useShell();
  const nav = useNavigate();
  return async (a: "rename" | "archive" | "delete") => {
    if (a === "rename") {
      nav({ to: "/projects/$id", params: { id: p.id } });
      return setRenaming(p.id);
    }
    if (a === "archive") await api(`/api/projects/${enc(p.id)}`, { method: "PATCH", body: { status: p.status === "active" ? "archived" : "active" } });
    if (a === "delete") {
      const ok = await confirmDialog({ title: `删除「${pname(p)}」？`, body: "对话、记忆和文件都会删除", confirm: "删除", danger: true });
      if (!ok) return;
      await api(`/api/projects/${enc(p.id)}`, { method: "DELETE" });
      if (localStorage.project === p.id) localStorage.project = "";
      nav({ to: "/projects" });
    }
    invalidate("projects", "project");
  };
}

/** The "⋯" menu for a project, in its sidebar row and in the project's top bar. */
export function ProjectMenu({ p, trigger }: { p: Project; trigger?: "toolbar" | "row" }) {
  const act = useProjectActions(p);
  return (
    <Menu>
      <MenuTrigger render={<Button type="button" variant="ghost" size={trigger === "row" ? "icon-xs" : "icon-sm"} aria-label="更多" />}>
        <MoreHorizontalIcon />
      </MenuTrigger>
      <MenuContent align="end">
        <MenuItem onClick={() => act("rename")}>重命名</MenuItem>
        <MenuItem onClick={() => act("archive")}>{p.status === "active" ? "归档" : "恢复"}</MenuItem>
        <MenuSeparator />
        <MenuItem variant="destructive" onClick={() => act("delete")}>删除</MenuItem>
      </MenuContent>
    </Menu>
  );
}

export function RenameBox({ p }: { p: Project }) {
  const { setRenaming } = useShell();
  const done = useRef(false);
  const born = useRef(Date.now());
  const finish = async (name: string | null) => {
    if (done.current) return;
    done.current = true;
    if (name && name !== p.name) await api(`/api/projects/${enc(p.id)}`, { method: "PATCH", body: { name } });
    setRenaming(null);
    invalidate("projects", "project");
  };
  return (
    <Input
      size="sm" className="renameBox max-w-xs" autoFocus placeholder="项目名" aria-label="项目名" defaultValue={p.name === UNTITLED ? "" : p.name}
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) finish(e.currentTarget.value.trim());
        if (e.key === "Escape") finish(null);
      }}
      onBlur={(e) => {
        // The menu that opened this hands focus back to its button as it closes; take it back once.
        if (Date.now() - born.current < 600) return void setTimeout(() => e.target.focus(), 0);
        finish(e.currentTarget.value.trim());
      }}
    />
  );
}

type Repo = { storage: "s3" | "local"; seq: number; path: string; commits: { sha: string; subject: string; at: number }[] };
function RepoBox({ p, open }: { p: Project; open: boolean }) {
  const [r, setR] = useState<Repo | null>(null);
  useEffect(() => void (open && api<Repo>(`/api/projects/${encodeURIComponent(p.id)}/git`).then(setR)), [open, p.id]);
  if (!r) return null;
  const cmd = `git clone ${location.origin}${r.path}`;
  return (
    <Section id="repoBox" title={`代码仓库 · ${r.storage === "s3" ? "S3" : "本机"}`} note="密码就是登录密码；Tomo 改的文件会自动提交">
      <SettingsRow>
        <code className="clone min-w-0 flex-1 font-mono text-ui-sm break-all">{cmd}</code>
        <ToolbarButton label="复制" onClick={() => navigator.clipboard?.writeText(cmd).then(() => toast("已复制"))}><CopyIcon /></ToolbarButton>
      </SettingsRow>
      {r.commits.map((c) => (
        <SettingsRow key={c.sha} data-commit={c.sha}>
          <SettingsRowText><SettingsRowTitle>{c.subject}</SettingsRowTitle><SettingsRowDescription>{c.sha.slice(0, 7)} · {ago(c.at)}</SettingsRowDescription></SettingsRowText>
        </SettingsRow>
      ))}
    </Section>
  );
}

function ProjectInfo({ p, open, onClose }: { p: Project; open: boolean; onClose: () => void }) {
  const mem = useMemories("", p.id).data ?? [];
  return (
    <Sheet open={open} onClose={onClose} title={pname(p)}>
      <Section title="简介">
        <div className="doc px-4 py-3">{p.brief ? <ResponseMarkdown text={p.brief} /> : <p className="text-ui text-muted-foreground">Tomo 了解目标后会写</p>}</div>
      </Section>
      {mem.length ? (
        <Section title={`记忆 · ${mem.length}`}>
          {mem.map((m) => (
            <SettingsRow key={m.id}><SettingsRowText><SettingsRowTitle>{m.content}</SettingsRowTitle><SettingsRowDescription>{ago(m.updated_at)}</SettingsRowDescription></SettingsRowText></SettingsRow>
          ))}
        </Section>
      ) : <p className="px-1 text-ui-sm text-muted-foreground">还没有记忆</p>}
      <RepoBox p={p} open={open} />
    </Sheet>
  );
}

export function ProjectsView({ id }: { id?: string }) {
  const list = useProjects();
  const nav = useNavigate();
  const newProject = useNewProject();
  // No project in the URL: reopen the last one, else the first active one.
  useEffect(() => {
    if (id || !list.data) return;
    const pick = list.data.find((p) => p.id === localStorage.project) ?? list.data.find((p) => p.status === "active") ?? list.data[0];
    if (pick) nav({ to: "/projects/$id", params: { id: pick.id }, replace: true });
  }, [id, list.data]);
  if (!id)
    return list.data && !list.data.length ? (
      <div id="projSlot" className="flex min-h-0 flex-1 flex-col">
        <TopBar title="项目" />
        <EmptyState size="lg" className="projEmpty flex-1">
          <EmptyStateIcon><FolderIcon /></EmptyStateIcon>
          <EmptyStateTitle>还没有项目</EmptyStateTitle>
          <EmptyStateDescription>适合要做好几天的事</EmptyStateDescription>
          <EmptyStateActions><Button id="emptyNewProject" onClick={newProject}>新建项目</Button></EmptyStateActions>
        </EmptyState>
      </div>
    ) : null;
  return <ProjectThread id={id} />;
}

function ProjectThread({ id }: { id: string }) {
  const p = useProject(id).data;
  const { setSearch, setChat, renaming } = useShell();
  const [info, setInfo] = useState(false);
  useEffect(() => void (localStorage.project = id), [id]);
  useEffect(() => void (p?.conversation_id && setChat({ conv: p.conversation_id, label: pname(p) })), [p?.conversation_id, p?.name]);
  if (!p) return null;
  const line = briefLine(p.brief);
  // The project agent names an untitled project on its first turn: look for the new name for a minute.
  const watchTitle = () => {
    if (p.name !== UNTITLED) return;
    [3, 8, 15, 30, 60].forEach((s) => setTimeout(() => qc.getQueryData<Project>(["project", id])?.name === UNTITLED && invalidate("project", "projects"), s * 1000));
  };
  return (
    <>
      <TopBar className="projBar" title={renaming === p.id ? <RenameBox p={p} /> : pname(p)} sub={line || undefined} onSub={() => setInfo(true)}>
        <ToolbarButton label="搜索" onClick={() => setSearch({ conv: p.conversation_id!, label: pname(p) })}><SearchIcon /></ToolbarButton>
        <ToolbarButton label="简介" onClick={() => setInfo(true)}><InfoIcon /></ToolbarButton>
        <ProjectMenu p={p} />
      </TopBar>
      <div id="projSlot" className="flex min-h-0 flex-1 flex-col">
        <ChatPane
          conv={p.conversation_id} placeholder="发消息给 Tomo" onSent={watchTitle}
          empty={<EmptyState size="lg" className="projStart"><EmptyStateTitle>要做什么？</EmptyStateTitle></EmptyState>}
        />
      </div>
      <ProjectInfo p={p} open={info} onClose={() => setInfo(false)} />
    </>
  );
}
