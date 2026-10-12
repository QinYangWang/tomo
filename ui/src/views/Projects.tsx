// Projects: each one is its own thread with its own memory. The sidebar lists them; the top bar names the open one.
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";
import { api, enc } from "../api.ts";
import { ChatPane } from "../components/ChatPane.tsx";
import { Sheet } from "../components/Sheet.tsx";
import { TopBar } from "../components/TopBar.tsx";
import { Icon } from "../icons.tsx";
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
  const finish = async (name: string | null) => {
    if (done.current) return;
    done.current = true;
    if (name && name !== p.name) await api(`/api/projects/${enc(p.id)}`, { method: "PATCH", body: { name } });
    setRenaming(null);
    invalidate("projects", "project");
  };
  return (
    <input
      className={`renameBox ${className ?? ""}`} autoFocus placeholder="项目名" defaultValue={p.name === UNTITLED ? "" : p.name}
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) finish(e.currentTarget.value.trim());
        if (e.key === "Escape") finish(null);
      }}
      onBlur={(e) => finish(e.currentTarget.value.trim())}
    />
  );
}

/** Rename · archive/restore · delete, for the sidebar rows and the project bar. */
export function ProjectMenu({ p, size = 16, className = "icon sm pMenuBtn" }: { p: Project; size?: number; className?: string }) {
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
    <MenuTrigger>
      <Button className={className} aria-label="更多"><Icon name="more" size={size} /></Button>
      <Popover className="pop" placement="bottom end">
        <Menu onAction={(k) => act(String(k))}>
          <MenuItem id="rename" className="mi"><Icon name="edit" size={16} />重命名</MenuItem>
          <MenuItem id="archive" className="mi"><Icon name={p.status === "active" ? "archive" : "refresh"} size={16} />{p.status === "active" ? "归档" : "恢复"}</MenuItem>
          <MenuItem id="delete" className="mi danger"><Icon name="trash" size={16} />删除</MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
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
      <div className="gtitle">代码仓库 · {r.storage === "s3" ? "S3" : "本机"}</div>
      <div className="group" id="repoBox">
        <div className="item"><code className="grow clone">{cmd}</code><Button className="icon" aria-label="复制" data-tip="复制" onPress={() => navigator.clipboard?.writeText(cmd).then(() => toast("已复制"))}><Icon name="copy" size={16} /></Button></div>
        {r.commits.map((c) => <div key={c.sha} className="item"><span className="grow">{c.subject}<div className="muted small">{c.sha.slice(0, 7)} · {ago(c.at)}</div></span></div>)}
      </div>
      <p className="note" style={{ marginTop: 10 }}>密码就是登录密码；Tomo 改的文件会自动提交</p>
    </>
  );
}

function ProjectInfo({ p, open, onClose }: { p: Project; open: boolean; onClose: () => void }) {
  const mem = useMemories("", p.id).data ?? [];
  return (
    <Sheet open={open} onClose={onClose} title={pname(p)} small>
      <div className="gtitle">简介</div>
      <div className="doc" style={{ marginTop: 10 }} dangerouslySetInnerHTML={{ __html: p.brief ? md(p.brief) : `<p class="muted">Tomo 了解目标后会写</p>` }} />
      <div className="gtitle">记忆 · {mem.length}</div>
      {mem.length ? (
        <div className="group">{mem.map((m) => <div key={m.id} className="item"><span className="grow">{m.content}<div className="muted small">{ago(m.updated_at)}</div></span></div>)}</div>
      ) : <p className="note" style={{ marginTop: 14 }}>还没有记忆</p>}
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
      <div id="projSlot">
        <TopBar title="项目" />
        <div className="projEmpty">
          <h2 className="serif">还没有项目</h2>
          <p className="muted">适合要做好几天的事</p>
          <div className="btns" style={{ justifyContent: "center" }}><button className="primary" onClick={newProject}>新建项目</button></div>
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
        <Button className="icon" aria-label="搜索" data-tip="搜索" onPress={() => setSearch({ conv: p.conversation_id!, label: pname(p) })}><Icon name="search" size={18} /></Button>
        <Button className="icon" aria-label="简介" data-tip="简介" onPress={() => setInfo(true)}><Icon name="info" size={18} /></Button>
        <ProjectMenu p={p} size={18} className="icon" />
      </TopBar>
      <div id="projSlot">
        <ChatPane conv={p.conversation_id} placeholder="发消息给 Tomo" empty={<div className="projStart"><b>要做什么？</b></div>} onSent={watchTitle} />
      </div>
      <ProjectInfo p={p} open={info} onClose={() => setInfo(false)} />
    </>
  );
}
