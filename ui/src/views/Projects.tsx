// Projects: each one is its own thread with its own memory. The sidebar lists them; the top bar names the open one.
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { api, enc } from "../api.ts";
import { ChatPane } from "../components/ChatPane.tsx";
import { ActionMenu, Btn, IconBtn } from "../components/kit.tsx";
import { Sheet } from "../components/Sheet.tsx";
import { Grow, Group, Md, Note, Row, SectionTitle, Sub } from "../components/ui.tsx";
import { TopBar } from "../components/TopBar.tsx";
import { ago, briefLine, md, pname, UNTITLED } from "../lib.ts";
import { invalidate, qc, useMemories, useProject, useProjects } from "../queries.ts";
import { confirmDialog, toast, useShell } from "../store.tsx";
import type { Project } from "../types.ts";

export function useNewProject() {
  const nav = useNavigate();
  return async () => {
    const p = await api<Project>("/api/projects", { method: "POST", body: {} });
    if ((p as any).error) return;
    await invalidate("projects");
    nav({ to: "/projects/$id", params: { id: p.id } });
    setTimeout(() => document.getElementById("t")?.focus(), 250);
  };
}

export function RenameBox({ p, className }: { p: Project; className?: string }) {
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
    <input
      className={`renameBox w-full rounded-lg border border-primary/50 bg-background px-2 py-0.5 text-[inherit] outline-none ring-2 ring-primary/20 ${className ?? ""}`} autoFocus placeholder="项目名" defaultValue={p.name === UNTITLED ? "" : p.name}
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) finish(e.currentTarget.value.trim());
        if (e.key === "Escape") finish(null);
      }}
      onBlur={(e) => {
        // The menu that opened this hands focus back to its button as it folds away; take it back once.
        if (Date.now() - born.current < 600) return void setTimeout(() => e.target.focus(), 0);
        finish(e.currentTarget.value.trim());
      }}
    />
  );
}

/** Rename · archive/restore · delete, for the sidebar rows and the project bar. */
export function ProjectMenu({ p, size = 16, className = "sm pMenuBtn size-7" }: { p: Project; size?: number; className?: string }) {
  const { setRenaming } = useShell();
  const nav = useNavigate();
  const act = async (a: string) => {
    if (a === "rename") return setRenaming(p.id);
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
  return (
    <ActionMenu
      className={className.includes("pMenuBtn") ? "pMenuWrap absolute right-1.5 top-1.5 z-20 desk:hidden desk:group-hover/row:inline-flex desk:[.on_&]:inline-flex" : undefined}
      trigger={<IconBtn className={className} icon="more" label="更多" size={size} tip={false} />}
      onAction={act}
      items={[
        { id: "rename", label: "重命名", icon: "edit" },
        { id: "archive", label: p.status === "active" ? "归档" : "恢复", icon: p.status === "active" ? "archive" : "refresh" },
        { id: "delete", label: "删除", icon: "trash", danger: true },
      ]}
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
    <>
      <SectionTitle>代码仓库 · {r.storage === "s3" ? "S3" : "本机"}</SectionTitle>
      <Group id="repoBox">
        <Row><code className="grow clone min-w-0 flex-1 break-all font-mono text-xs leading-5">{cmd}</code><IconBtn icon="copy" label="复制" size={16} onClick={() => navigator.clipboard?.writeText(cmd).then(() => toast("已复制"))} /></Row>
        {r.commits.map((c) => <Row key={c.sha}><Grow>{c.subject}<Sub>{c.sha.slice(0, 7)} · {ago(c.at)}</Sub></Grow></Row>)}
      </Group>
      <Note>密码就是登录密码；Tomo 改的文件会自动提交</Note>
    </>
  );
}

function ProjectInfo({ p, open, onClose }: { p: Project; open: boolean; onClose: () => void }) {
  const mem = useMemories("", p.id).data ?? [];
  return (
    <Sheet open={open} onClose={onClose} title={pname(p)} small>
      <SectionTitle>简介</SectionTitle>
      <Md className="doc rounded-2xl border border-border bg-card px-5 py-4 text-sm" html={p.brief ? md(p.brief) : `<p style="opacity:.6">Tomo 了解目标后会写</p>`} />
      <SectionTitle>记忆 · {mem.length}</SectionTitle>
      {mem.length ? (
        <Group>{mem.map((m) => <Row key={m.id}><Grow>{m.content}<Sub>{ago(m.updated_at)}</Sub></Grow></Row>)}</Group>
      ) : <Note>还没有记忆</Note>}
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
        <div className="projEmpty flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">还没有项目</h2>
          <p className="text-sm text-muted-foreground">适合要做好几天的事</p>
          <div className="btns mt-4 flex justify-center"><Btn onClick={newProject}>新建项目</Btn></div>
        </div>
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
        <IconBtn icon="search" label="搜索" onClick={() => setSearch({ conv: p.conversation_id!, label: pname(p) })} />
        <IconBtn icon="info" label="简介" onClick={() => setInfo(true)} />
        <ProjectMenu p={p} size={18} className="" />
      </TopBar>
      <div id="projSlot" className="flex min-h-0 flex-1 flex-col">
        <ChatPane conv={p.conversation_id} placeholder="发消息给 Tomo" empty={<div className="projStart grid min-h-[40vh] place-items-center text-2xl font-semibold tracking-tight">要做什么？</div>} onSent={watchTitle} />
      </div>
      <ProjectInfo p={p} open={info} onClose={() => setInfo(false)} />
    </>
  );
}
