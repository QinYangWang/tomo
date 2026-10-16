// Left side of the shell: the icon rail (one page per icon; bottom tabs on phones) and, for pages that have one, their own list.
import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BotIcon, CalendarDaysIcon, ChatIcon, FolderIcon, HistoryIcon, HomeIcon, LightbulbIcon, LockIcon, LogOutIcon, PlusIcon, ServerIcon, SettingsIcon, SidebarIcon, SparklesIcon, UserIcon, BoltIcon } from "@/components/icons";
import { Drawer, DrawerContent, DrawerTitle } from "@/ui/drawer";
import { IconRail, IconRailItem, IconRailSeparator, IconRailSpacer } from "@/ui/icon-rail";
import { ScrollArea } from "@/ui/scroll-area";
import { SettingsNav, SettingsNavItem } from "@/ui/settings-section";
import { ThreadList, ThreadListGroup, ThreadListItem } from "@/ui/thread-list-item";
import { ago, briefLine, pname } from "../lib.ts";
import { useConversations, useProjects } from "../queries.ts";
import { GROUPS, logout, PAGES } from "../settings/shared.ts";
import { usePhone, useShell } from "../store.tsx";
import type { Project } from "../types.ts";
import { ProjectMenu, useNewProject } from "../views/Projects.tsx";
import { ToolbarButton } from "./parts.tsx";

export type Section = "home" | "chat" | "projects" | "schedules" | "memory" | "skills" | "settings";
/** Pages that carry a list beside them; the rest use the full width. */
export const HAS_SIDE: Section[] = ["chat", "projects", "settings"];
const NAV: [Section, string, ReactNode, string, boolean?][] = [
  ["home", "首页", <HomeIcon />, "/"],
  ["chat", "对话", <ChatIcon />, "/chat"],
  ["projects", "项目", <FolderIcon />, "/projects"],
  ["schedules", "定时", <CalendarDaysIcon />, "/schedules", true],
  ["memory", "记忆", <LightbulbIcon />, "/memory", true],
  ["skills", "技能", <BoltIcon />, "/skills", true],
];
/** Settings pages and the rail's tool pages share these glyphs (solid family, as navigation). */
export const PAGE_ICON: Record<string, ReactNode> = {
  profile: <UserIcon />, accounts: <ChatIcon />, models: <BotIcon />, storage: <ServerIcon />, backup: <HistoryIcon />, security: <LockIcon />, about: <SparklesIcon />,
  schedules: <CalendarDaysIcon />, memory: <LightbulbIcon />, skills: <BoltIcon />,
};

/** The app rail: a column on wide screens, the bottom tab bar on phones (where 定时/记忆/技能 live in settings). */
export function Rail({ section, onSettings }: { section: Section; onSettings: () => void }) {
  const phone = usePhone();
  const items = phone ? NAV.filter((n) => !n[4]) : NAV;
  return (
    // TODO(qinyang-gap): bottom tab bar with a label under each icon (IconRail horizontal has icons and tooltips only).
    <IconRail id="rail" aria-label="导航" orientation={phone ? "horizontal" : "vertical"} className={phone ? "justify-around" : undefined}>
      {items.map(([k, label, icon, to], i) => (
        <span key={k} className="contents">
          {!phone && i === 3 && <IconRailSeparator />}
          <IconRailItem label={label} icon={icon} active={section === k} render={<Link to={to} data-view={k} />} />
        </span>
      ))}
      {!phone && <IconRailSpacer />}
      <IconRailItem id="setBtn" label="设置" icon={<SettingsIcon />} active={section === "settings"} onClick={onSettings} />
    </IconRail>
  );
}

const DAY = 86400000;
function byDay(list: Project[]) {
  const today = +new Date(new Date().toDateString());
  const g: [string, Project[]][] = [["今天", []], ["昨天", []], ["本周", []], ["更早", []]];
  for (const p of list) g[p.updated_at >= today ? 0 : p.updated_at >= today - DAY ? 1 : p.updated_at >= today - 6 * DAY ? 2 : 3]![1].push(p);
  return g.filter(([, ps]) => ps.length);
}

/** Title row of the list, level with the main pane's top bar. */
function SideHead({ title, children }: { title: string; children?: ReactNode }) {
  const { toggleSide } = useShell();
  const phone = usePhone();
  return (
    <div className="mt-0.75 flex h-12 shrink-0 items-center gap-1 ps-4 pe-2">
      <span className="min-w-0 flex-1 truncate text-ui-lg font-semibold">{title}</span>
      {children}
      {!phone && <ToolbarButton id="sideBtn" label="收起" onClick={toggleSide}><SidebarIcon /></ToolbarButton>}
    </div>
  );
}
const List = ({ children }: { children: ReactNode }) => (
  <ScrollArea className="min-h-0 flex-1" viewportClassName="px-2 pb-6">{children}</ScrollArea>
);
const Note = ({ children }: { children: string }) => <p className="px-2 py-3 text-ui-sm text-muted-foreground">{children}</p>;

function ChatList() {
  const { chat } = useShell();
  const nav = useNavigate();
  const convs = useConversations().data ?? [];
  const rows = convs.length ? convs : [{ id: "home", key: "home", platform: "web" }];
  return (
    <>
      <SideHead title="对话" />
      <List>
        {/* TODO(qinyang-gap): ThreadListItem has no free-form subtitle line (needed for "各平台的私聊都在这" / the platform name). */}
        <ThreadList>
          <ThreadListGroup label="全部">
            {rows.map((v) => {
              const id = v.key === "home" ? "home" : v.id;
              return (
                <ThreadListItem
                  key={id} data-conv={id} title={v.key === "home" ? "私聊" : v.key} active={chat.conv === id}
                  icon={v.key === "home" ? <UserIcon /> : <ChatIcon />}
                  trailing={v.key === "home" ? undefined : <span className="text-ui-xs text-muted-foreground">{v.platform}</span>}
                  onClick={() => nav({ to: "/chat", search: id === "home" ? {} : { c: id } })}
                />
              );
            })}
          </ThreadListGroup>
        </ThreadList>
        <Note>群聊会各自出现在这里</Note>
      </List>
    </>
  );
}

function ProjectList({ current }: { current?: string }) {
  const nav = useNavigate();
  const newProject = useNewProject();
  const projects = useProjects().data ?? [];
  const active = projects.filter((p) => p.status === "active").sort((a, b) => b.updated_at - a.updated_at);
  const archived = projects.filter((p) => p.status !== "active");
  const row = (p: Project) => (
    <ThreadListItem
      key={p.id} data-project={p.id} title={pname(p)} repo={briefLine(p.brief) || undefined} active={p.id === current} icon={<FolderIcon />}
      onClick={(e) => {
        // Clicks from the row's own menu (and its portalled popup) are not row clicks.
        if (!e.currentTarget.contains(e.target as Node) || (e.target as HTMLElement).closest("[data-slot=button]")) return;
        nav({ to: "/projects/$id", params: { id: p.id } });
      }}
      trailing={
        <>
          <span className="text-ui-xs text-muted-foreground tabular-nums group-hover/thread:hidden group-data-active/thread:hidden pointer-coarse:hidden">{ago(p.updated_at)}</span>
          <span className="hidden group-hover/thread:flex group-data-active/thread:flex pointer-coarse:flex"><ProjectMenu p={p} trigger="row" /></span>
        </>
      }
    />
  );
  return (
    <>
      <SideHead title="项目">
        <ToolbarButton id="newProject" label="新建项目" onClick={() => newProject()}><PlusIcon /></ToolbarButton>
      </SideHead>
      <List>
        <ThreadList>
          {byDay(active).map(([label, ps]) => <ThreadListGroup key={label} label={label}>{ps.map(row)}</ThreadListGroup>)}
          {!!archived.length && <ThreadListGroup label="已归档" data-archived="">{archived.map(row)}</ThreadListGroup>}
        </ThreadList>
        {!active.length && <Note>还没有项目</Note>}
      </List>
    </>
  );
}

function SettingsList({ page }: { page?: string }) {
  return (
    <>
      <SideHead title="设置" />
      <List>
        <SettingsNav className="flex-col">
          {GROUPS.flat().map((k) => (
            <SettingsNavItem key={k} isActive={page === k} icon={PAGE_ICON[k]} data-s={k} render={<Link to="/settings/$page" params={{ page: k }} />}>{PAGES[k]![0]}</SettingsNavItem>
          ))}
          <SettingsNavItem id="logoutBtn" icon={<LogOutIcon />} render={<button type="button" onClick={logout} />}>退出登录</SettingsNavItem>
        </SettingsNav>
      </List>
    </>
  );
}

function SideContent({ section, current, page }: { section: Section; current?: string; page?: string }) {
  return section === "chat" ? <ChatList /> : section === "projects" ? <ProjectList current={current} /> : <SettingsList page={page} />;
}

/** The page's list: a column beside the main pane on wide screens, a drawer on phones. */
export function Sidebar(p: { section: Section; current?: string; page?: string }) {
  const { side, sideMobile, closeMobileSide } = useShell();
  const phone = usePhone();
  if (!HAS_SIDE.includes(p.section)) return null;
  if (phone)
    return (
      <Drawer side="left" open={sideMobile} onOpenChange={(o) => !o && closeMobileSide()}>
        <DrawerContent showClose={false} className="w-72">
          <DrawerTitle className="sr-only">列表</DrawerTitle>
          <aside id="side" className="flex min-h-0 flex-1 flex-col"><SideContent {...p} /></aside>
        </DrawerContent>
      </Drawer>
    );
  if (!side) return null;
  return <aside id="side" className="flex w-64 shrink-0 flex-col"><SideContent {...p} /></aside>;
}
