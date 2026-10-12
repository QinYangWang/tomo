// Left side of the shell: the icon rail (one page per icon; bottom tabs on phones) and, for pages that have one, their own list.
import { Link, useNavigate } from "@tanstack/react-router";
import { SharedLayoutBg } from "@/components/motion/shared-layout-bg";
import { Tooltip } from "@/components/motion/tooltip";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "../icons.tsx";
import { ago, briefLine, pname } from "../lib.ts";
import { useConversations, useProjects } from "../queries.ts";
import { GROUPS, logout, PAGES } from "../settings/shared.ts";
import { isPhone, useShell } from "../store.tsx";
import type { Project } from "../types.ts";
import { ProjectMenu, RenameBox, useNewProject } from "../views/Projects.tsx";
import { IconBtn } from "./kit.tsx";

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

const RAIL_ITEM =
  "relative grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground " +
  "max-desk:flex max-desk:h-14 max-desk:w-auto max-desk:flex-1 max-desk:flex-col max-desk:gap-0.5 max-desk:rounded-none max-desk:hover:bg-transparent";
const RAIL_ON = "on bg-foreground/[0.06] text-foreground max-desk:bg-transparent";
// Phones show the labels under the icons, so the hover tooltip would only linger after a tap.
const Tip = ({ content, children }: { content: string; children: React.ReactElement }) => (isPhone() ? children : <Tooltip content={content} side="right">{children}</Tooltip>);
const RailLabel = ({ children }: { children: string }) => <span className="rl text-[10px] font-medium desk:hidden">{children}</span>;

export function Rail({ section, onSettings }: { section: Section; onSettings: () => void }) {
  return (
    <nav
      id="rail" aria-label="导航"
      className="z-30 flex w-16 shrink-0 flex-col items-center justify-between border-r border-border py-3 max-desk:bg-background/80 max-desk:backdrop-blur-xl max-desk:fixed max-desk:inset-x-0 max-desk:bottom-0 max-desk:h-[calc(64px+env(safe-area-inset-bottom))] max-desk:w-full max-desk:flex-row max-desk:items-start max-desk:border-t max-desk:border-r-0 max-desk:py-0 max-desk:pb-[env(safe-area-inset-bottom)]"
    >
      <div className="railMain flex flex-col items-center gap-1 max-desk:flex-[3] max-desk:flex-row max-desk:gap-0">
        {NAV.map(([k, label, icon, to, extra], i) => (
          <span key={k} className={cn("railSlot flex flex-col items-center gap-1 max-desk:flex-1", extra && "max-desk:hidden")}>
            {i === 3 && <span className="railSep my-2 h-px w-6 bg-border max-desk:hidden" />}
            <Tip content={label}>
              <Link to={to} data-view={k} aria-label={label} className={cn(RAIL_ITEM, section === k && RAIL_ON, extra && "railExtra")}>
                <Icon name={icon} /><RailLabel>{label}</RailLabel>
              </Link>
            </Tip>
          </span>
        ))}
      </div>
      <span className="flex max-desk:flex-1 max-desk:justify-center">
      <Tip content="设置">
        <button type="button" id="setBtn" aria-label="设置" className={cn(RAIL_ITEM, "max-desk:flex-1", section === "settings" && RAIL_ON)} onClick={onSettings}>
          <Icon name="settings" /><RailLabel>设置</RailLabel>
        </button>
      </Tip>
      </span>
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

/** Rows share one hover highlight that glides between them (beUI shared layout). */
const Rows = ({ children }: { children: React.ReactNode }) => (
  <SharedLayoutBg className="sRows gap-px" inset={0} pillClassName="rounded-xl bg-foreground/[0.05]">{children}</SharedLayoutBg>
);
const ROW = "sRow flex min-w-0 cursor-pointer flex-col gap-0.5 rounded-xl px-3 py-2 text-foreground [&>.z-10]:flex [&>.z-10]:min-w-0 [&>.z-10]:flex-col [&>.z-10]:gap-0.5";
const ROW_ON = "on bg-foreground/[0.07]";
const Title = ({ children, one }: { children: React.ReactNode; one?: boolean }) => (
  <span className={cn("sTitle truncate text-[13.5px] leading-5", one ? "one flex items-center gap-2 [&_svg]:text-muted-foreground" : "pr-6")}>{children}</span>
);
const Meta = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={cn("sMeta flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground", className)}>{children}</span>
);
const GroupTitle = ({ children }: { children: string }) => <div className="gtitle px-3 pt-4 pb-1.5 text-[11px] font-medium text-muted-foreground">{children}</div>;
const Note = ({ children }: { children: string }) => <div className="sNote px-3 py-3 text-xs text-muted-foreground">{children}</div>;

function SideHead({ title, children }: { title: string; children?: React.ReactNode }) {
  const { toggleSide } = useShell();
  return (
    <div className="sideHead flex h-14 shrink-0 items-center gap-1 px-4">
      <span className="brand flex-1 text-[15px] font-semibold tracking-tight">{title}</span>
      {children}
      <IconBtn id="sideBtn" icon="sidebar" label="收起" size={17} onClick={toggleSide} />
    </div>
  );
}
const List = ({ children }: { children: React.ReactNode }) => <div className="sideList flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-6">{children}</div>;

function ChatList() {
  const { chat, closeMobileSide } = useShell();
  const convs = useConversations().data ?? [];
  const rows = convs.length ? convs : [{ id: "home", key: "home", platform: "web" }];
  return (
    <>
      <SideHead title="对话" />
      <List>
        <Rows>
          {rows.map((v) => {
            const id = v.key === "home" ? "home" : v.id;
            return (
              <Link key={id} to="/chat" search={id === "home" ? {} : { c: id }} className={cn(ROW, chat.conv === id && ROW_ON)} onClick={() => isPhone() && closeMobileSide()}>
                <Title>{v.key === "home" ? "私聊" : v.key}</Title>
                <Meta><Icon name={v.key === "home" ? "user" : "chat"} size={13} /><span className="ell truncate">{v.key === "home" ? "各平台的私聊都在这" : v.platform}</span></Meta>
              </Link>
            );
          })}
        </Rows>
        <Note>群聊会各自出现在这里</Note>
      </List>
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
      key={p.id} className={cn(ROW, "pRow group/row relative", p.id === current && ROW_ON)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button, input")) return;
        nav({ to: "/projects/$id", params: { id: p.id } });
        if (isPhone()) closeMobileSide();
      }}
    >
      <Title>{renaming === p.id && p.id !== current ? <RenameBox p={p} /> : pname(p)}</Title>
      <Meta><span className="ell min-w-0 flex-1 truncate">{briefLine(p.brief) || " "}</span><span className={cn("when shrink-0", "desk:group-hover/row:invisible", p.id === current && "desk:invisible")}>{ago(p.updated_at)}</span></Meta>
      <ProjectMenu p={p} />
    </div>
  );
  return (
    <>
      <SideHead title="项目">
        <IconBtn id="newProject" icon="add" label="新建项目" onClick={() => (newProject(), isPhone() && closeMobileSide())} />
      </SideHead>
      <List>
        {byDay(active).map(([label, ps]) => (
          <div key={label} className="sGroup"><GroupTitle>{label}</GroupTitle><Rows>{ps.map(row)}</Rows></div>
        ))}
        {!active.length && <Note>还没有项目</Note>}
        {!!archived.length && <div className="sGroup"><GroupTitle>已归档</GroupTitle><Rows>{archived.map(row)}</Rows></div>}
      </List>
    </>
  );
}

function SettingsNav({ page }: { page?: string }) {
  const { closeMobileSide } = useShell();
  return (
    <>
      <SideHead title="设置" />
      <List>
        {GROUPS.map((g, i) => (
          <div key={i} className={i ? "mt-3" : ""}>
            <Rows>
              {g.map((k) => (
                <Link key={k} to="/settings/$page" params={{ page: k }} data-s={k} className={cn(ROW, page === k && ROW_ON)} onClick={() => isPhone() && closeMobileSide()}>
                  <Title one><Icon name={PAGES[k]![1]} size={16} />{PAGES[k]![0]}</Title>
                  <Meta className="pl-6">{PAGES[k]![2]}</Meta>
                </Link>
              ))}
            </Rows>
          </div>
        ))}
        <button type="button" id="logoutBtn" onClick={logout} className={cn(ROW, "sLogout mt-3 text-left hover:bg-foreground/[0.05]")}>
          <Title one><Icon name="logout" size={16} />退出登录</Title>
        </button>
      </List>
    </>
  );
}

export function Sidebar({ section, current, page }: { section: Section; current?: string; page?: string }) {
  const { side, sideMobile, closeMobileSide } = useShell();
  if (!HAS_SIDE.includes(section)) return null;
  return (
    <>
      <aside
        id="side"
        className={cn(
          "z-40 flex w-72 shrink-0 flex-col border-r border-border bg-card/60",
          !side && "desk:hidden",
          "max-desk:fixed max-desk:inset-y-0 max-desk:left-0 max-desk:w-[84vw] max-desk:max-w-80 max-desk:bg-background max-desk:shadow-2xl max-desk:transition-transform max-desk:duration-300 max-desk:ease-[var(--ease-drawer)]",
          !sideMobile && "max-desk:-translate-x-full max-desk:shadow-none",
        )}
      >
        {section === "chat" ? <ChatList /> : section === "projects" ? <ProjectList current={current} /> : <SettingsNav page={page} />}
      </aside>
      <div
        className={cn("sideScrim fixed inset-0 z-30 bg-black/30 backdrop-blur-[2px] transition-opacity desk:hidden", sideMobile ? "opacity-100" : "pointer-events-none opacity-0")}
        onClick={closeMobileSide}
      />
    </>
  );
}
