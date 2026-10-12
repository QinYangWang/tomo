// Left side of the shell: the icon rail (sections) and the sidebar (chats + projects by day, or the settings nav).
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "react-aria-components";
import { Icon, type IconName } from "../icons.tsx";
import { ago, briefLine, pname } from "../lib.ts";
import { useConversations, useProjects, useSettings } from "../queries.ts";
import { GROUPS, PAGES } from "../settings/shared.ts";
import { isPhone, useShell } from "../store.tsx";
import type { Project } from "../types.ts";
import { ProjectMenu, RenameBox, useNewProject } from "../views/Projects.tsx";

export type Section = "home" | "chat" | "projects" | "settings";
const MAIN: [Section, string, IconName, string][] = [["home", "Home", "home", "/"], ["chat", "对话", "chat", "/chat"], ["projects", "项目", "projects", "/projects"]];
const SHORTCUTS: [string, string, IconName][] = [["schedules", "定时任务", "clock"], ["memory", "记忆", "brain"], ["skills", "技能", "skill"]];

export function Rail({ section, page, onSettings }: { section: Section; page?: string; onSettings: () => void }) {
  return (
    <nav id="rail" aria-label="分区">
      <div className="railMain">
        {MAIN.map(([k, label, icon, to]) => (
          <Link key={k} to={to} data-view={k} aria-label={label} data-tip={label} className={section === k ? "on" : ""}>
            <Icon name={icon} /><span className="rl">{label}</span>
          </Link>
        ))}
        <span className="railSep" />
        {SHORTCUTS.map(([k, label, icon]) => (
          <Link key={k} to="/settings/$page" params={{ page: k }} aria-label={label} data-tip={label} className={`railExtra ${section === "settings" && page === k ? "on" : ""}`}>
            <Icon name={icon} />
          </Link>
        ))}
      </div>
      <Button id="setBtn" aria-label="设置" data-tip="设置" className={section === "settings" && !SHORTCUTS.some(([k]) => k === page) ? "on" : ""} onPress={onSettings}>
        <Icon name="settings" /><span className="rl">设置</span>
      </Button>
    </nav>
  );
}

const DAY = 86400000;
function byDay(list: Project[]) {
  const today = +new Date(new Date().toDateString());
  const g: [string, Project[]][] = [["今天", []], ["昨天", []], ["本周", []], ["更早", []]];
  for (const p of list) g[p.updated_at >= today ? 0 : p.updated_at >= today - DAY ? 1 : p.updated_at >= today - 6 * DAY ? 2 : 3]![1].push(p);
  return g.filter(([, ps]) => ps.length);
}

export function Sidebar({ section, current, page }: { section: Section; current?: string; page?: string }) {
  const { toggleSide, closeMobileSide, setNewPanel, setSearch, chat, renaming } = useShell();
  const nav = useNavigate();
  const newProject = useNewProject();
  const convs = useConversations().data ?? [];
  const projects = useProjects().data ?? [];
  const who = useSettings().data?.profile;
  const go = (fn: () => void) => () => (fn(), isPhone() && closeMobileSide());

  const active = projects.filter((p) => p.status === "active").sort((a, b) => b.updated_at - a.updated_at);
  const archived = projects.filter((p) => p.status !== "active");
  const convId = section === "chat" ? chat.conv : undefined;

  const pRow = (p: Project) => (
    <div
      key={p.id} className={`sRow pRow ${p.id === current ? "on" : ""}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button, input")) return;
        nav({ to: "/projects/$id", params: { id: p.id } });
        if (isPhone()) closeMobileSide();
      }}
    >
      <span className="sTitle">{renaming === p.id ? <RenameBox p={p} /> : pname(p)}</span>
      <span className="sMeta"><Icon name="projects" size={13} /><span className="ell">{briefLine(p.brief) || "项目"}</span><span className="when">{ago(p.updated_at)}</span></span>
      <ProjectMenu p={p} />
    </div>
  );

  return (
    <>
      <aside id="side">
        <div className="sideHead">
          <span className="brand">{section === "settings" ? "设置" : "Tomo"}</span>
          <Button className="icon sm" aria-label="搜索聊天记录" onPress={() => setSearch(chat)}><Icon name="search" size={17} /></Button>
          <Button className="icon sm" id="sideBtn" aria-label="收起侧栏" onPress={toggleSide}><Icon name="sidebar" size={17} /></Button>
        </div>
        {section === "settings" ? (
          <div className="sideList">
            <Link className="sRow one setMe" to="/settings">
              <span className="avatar xs">{(who?.nickname || who?.name || "?").slice(0, 1).toUpperCase()}</span>
              <span className="sTitle">{who?.nickname || who?.name || "我"}</span>
            </Link>
            {GROUPS.map((g, i) => (
              <div key={i} className="sGroup">
                {g.map((k) => (
                  <Link key={k} to="/settings/$page" params={{ page: k }} data-s={k} className={`sRow one ${page === k ? "on" : ""}`} onClick={go(() => {})}>
                    <Icon name={PAGES[k]![1]} size={17} /><span className="sTitle">{PAGES[k]![0]}</span>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="sideList">
            <button className="sAction" id="newProject" aria-label="新建项目" onClick={go(newProject)}><Icon name="edit" size={17} />新建项目</button>
            <button className="sAction" onClick={go(() => setNewPanel(true))}><Icon name="dashboard" size={17} />新建面板</button>

            <div className="gtitle">对话</div>
            {(convs.length ? convs : [{ id: "home", key: "home", platform: "web" }]).map((v) => {
              const id = v.key === "home" ? "home" : v.id;
              return (
                <Link key={id} to="/chat" search={id === "home" ? {} : { c: id }} className={`sRow ${convId === id ? "on" : ""}`} onClick={go(() => {})}>
                  <span className="sTitle">{v.key === "home" ? "Home" : v.key}</span>
                  <span className="sMeta"><Icon name={v.key === "home" ? "home" : "chat"} size={13} /><span className="ell">{v.key === "home" ? "所有平台的私聊" : v.platform}</span></span>
                </Link>
              );
            })}

            {byDay(active).map(([label, ps]) => (
              <div key={label} className="sGroup">
                <div className="gtitle">{label}</div>
                {ps.map(pRow)}
              </div>
            ))}
            {!active.length && <div className="sEmpty">还没有项目。项目适合要花好几天的事，每个都有自己的对话和记忆。</div>}
            {!!archived.length && (
              <div className="sGroup">
                <div className="gtitle">已归档</div>
                {archived.map(pRow)}
              </div>
            )}
          </div>
        )}
      </aside>
      <div className="sideScrim" onClick={closeMobileSide} />
    </>
  );
}
