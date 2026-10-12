// Left side of the shell: the icon rail (one page per icon) and, for pages that have one, their own sidebar list.
import { Link, useNavigate } from "@tanstack/react-router";
import { Tooltip } from "@/components/motion/tooltip";
import { SharedLayoutBg } from "@/components/motion/shared-layout-bg";
import { IconBtn } from "./kit.tsx";
import { Icon, type IconName } from "../icons.tsx";
import { ago, briefLine, pname } from "../lib.ts";
import { useConversations, useProjects } from "../queries.ts";
import { GROUPS, logout, PAGES } from "../settings/shared.ts";
import { isPhone, useShell } from "../store.tsx";
import type { Project } from "../types.ts";
import { ProjectMenu, RenameBox, useNewProject } from "../views/Projects.tsx";

export type Section = "home" | "chat" | "projects" | "schedules" | "memory" | "skills" | "settings";
/** Pages that carry a list beside them; the rest use the full width. */
export const HAS_SIDE: Section[] = ["chat", "projects", "settings"];
const NAV: [Section, string, IconName, string, boolean?][] = [
  ["home", "首页", "home", "/"],
  ["chat", "对话", "chat", "/chat"],
  ["projects", "项目", "projects", "/projects"],
  ["schedules", "定时", "clock", "/schedules", true],
  ["memory", "记忆", "brain", "/memory", true],
  ["skills", "技能", "skill", "/skills", true],
];

export function Rail({ section, onSettings }: { section: Section; onSettings: () => void }) {
  return (
    <nav id="rail" aria-label="导航">
      <div className="railMain">
        {NAV.map(([k, label, icon, to, extra], i) => (
          <span key={k} className="railSlot">
            {i === 3 && <span className="railSep" />}
            <Tooltip content={label} side="right">
              <Link to={to} data-view={k} aria-label={label} className={`${extra ? "railExtra" : ""} ${section === k ? "on" : ""}`}>
                <Icon name={icon} /><span className="rl">{label}</span>
              </Link>
            </Tooltip>
          </span>
        ))}
      </div>
      <Tooltip content="设置" side="right">
        <button type="button" id="setBtn" aria-label="设置" className={section === "settings" ? "on" : ""} onClick={onSettings}>
          <Icon name="settings" /><span className="rl">设置</span>
        </button>
      </Tooltip>
    </nav>
  );
}

const DAY = 86400000;
const PILL = "rounded-[8px] bg-muted";
/** Rows share one hover highlight that glides between them (beUI shared layout). */
const Rows = ({ children }: { children: React.ReactNode }) => <SharedLayoutBg className="sRows" inset={0} pillClassName={PILL}>{children}</SharedLayoutBg>;
function byDay(list: Project[]) {
  const today = +new Date(new Date().toDateString());
  const g: [string, Project[]][] = [["今天", []], ["昨天", []], ["本周", []], ["更早", []]];
  for (const p of list) g[p.updated_at >= today ? 0 : p.updated_at >= today - DAY ? 1 : p.updated_at >= today - 6 * DAY ? 2 : 3]![1].push(p);
  return g.filter(([, ps]) => ps.length);
}

function SideHead({ title, children }: { title: string; children?: React.ReactNode }) {
  const { toggleSide } = useShell();
  return (
    <div className="sideHead">
      <span className="brand">{title}</span>
      {children}
      <IconBtn className="sm" id="sideBtn" icon="sidebar" label="收起" size={17} onClick={toggleSide} />
    </div>
  );
}

function ChatList() {
  const { chat, closeMobileSide } = useShell();
  const convs = useConversations().data ?? [];
  const rows = convs.length ? convs : [{ id: "home", key: "home", platform: "web" }];
  return (
    <>
      <SideHead title="对话" />
      <div className="sideList"><Rows>
        {rows.map((v) => {
          const id = v.key === "home" ? "home" : v.id;
          return (
            <Link key={id} to="/chat" search={id === "home" ? {} : { c: id }} className={`sRow ${chat.conv === id ? "on" : ""}`} onClick={() => isPhone() && closeMobileSide()}>
              <span className="sTitle">{v.key === "home" ? "私聊" : v.key}</span>
              <span className="sMeta"><Icon name={v.key === "home" ? "user" : "chat"} size={13} /><span className="ell">{v.key === "home" ? "各平台的私聊都在这" : v.platform}</span></span>
            </Link>
          );
        })}
        </Rows>
        <div className="sNote">群聊会各自出现在这里</div>
      </div>
    </>
  );
}

function ProjectList({ current }: { current?: string }) {
  const { closeMobileSide, renaming } = useShell();
  const nav = useNavigate();
  const newProject = useNewProject();
  const projects = useProjects().data ?? [];
  const active = projects.filter((p) => p.status === "active").sort((a, b) => b.updated_at - a.updated_at);
  const archived = projects.filter((p) => p.status !== "active");
  const row = (p: Project) => (
    <div
      key={p.id} className={`sRow pRow ${p.id === current ? "on" : ""}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button, input")) return;
        nav({ to: "/projects/$id", params: { id: p.id } });
        if (isPhone()) closeMobileSide();
      }}
    >
      <span className="sTitle">{renaming === p.id && p.id !== current ? <RenameBox p={p} /> : pname(p)}</span>
      <span className="sMeta"><span className="ell">{briefLine(p.brief) || " "}</span><span className="when">{ago(p.updated_at)}</span></span>
      <ProjectMenu p={p} />
    </div>
  );
  return (
    <>
      <SideHead title="项目">
        <IconBtn className="sm" id="newProject" icon="add" label="新建项目" onClick={() => (newProject(), isPhone() && closeMobileSide())} />
      </SideHead>
      <div className="sideList">
        {byDay(active).map(([label, ps]) => (
          <div key={label} className="sGroup"><div className="gtitle">{label}</div><Rows>{ps.map(row)}</Rows></div>
        ))}
        {!active.length && <div className="sNote">还没有项目</div>}
        {!!archived.length && <div className="sGroup"><div className="gtitle">已归档</div><Rows>{archived.map(row)}</Rows></div>}
      </div>
    </>
  );
}

function SettingsNav({ page }: { page?: string }) {
  const { closeMobileSide } = useShell();
  return (
    <>
      <SideHead title="设置" />
      <div className="sideList">
        {GROUPS.map((g, i) => (
          <Rows key={i}>
            {g.map((k) => (
              <Link key={k} to="/settings/$page" params={{ page: k }} data-s={k} className={`sRow ${page === k ? "on" : ""}`} onClick={() => isPhone() && closeMobileSide()}>
                <span className="sTitle one"><Icon name={PAGES[k]![1]} size={16} />{PAGES[k]![0]}</span>
                <span className="sMeta">{PAGES[k]![2]}</span>
              </Link>
            ))}
          </Rows>
        ))}
        <button className="sRow sLogout" id="logoutBtn" onClick={logout}><span className="sTitle one"><Icon name="logout" size={16} />退出登录</span></button>
      </div>
    </>
  );
}

export function Sidebar({ section, current, page }: { section: Section; current?: string; page?: string }) {
  const { closeMobileSide } = useShell();
  if (!HAS_SIDE.includes(section)) return null;
  return (
    <>
      <aside id="side">
        {section === "chat" ? <ChatList /> : section === "projects" ? <ProjectList current={current} /> : <SettingsNav page={page} />}
      </aside>
      <div className="sideScrim" onClick={closeMobileSide} />
    </>
  );
}
