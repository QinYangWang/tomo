// Shell: sign-in gate, the floating top bar (context button · dock · settings), and the routed views.
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { session } from "./api.ts";
import { ConfirmHost } from "./components/Sheet.tsx";
import { Gate } from "./components/Gate.tsx";
import { SearchSheet } from "./components/SearchSheet.tsx";
import { Toast } from "./components/Toast.tsx";
import { Icon, type IconName } from "./icons.tsx";
import { hasKey, qc, useSettings } from "./queries.ts";
import { Onboarding } from "./settings/Onboarding.tsx";
import { useShell } from "./store.tsx";
import { NewPanelSheet } from "./views/Home.tsx";
import { Drawer } from "./views/Projects.tsx";

type Section = "home" | "chat" | "projects" | "settings";
const sectionOf = (path: string): Section =>
  path.startsWith("/chat") ? "chat" : path.startsWith("/projects") ? "projects" : path.startsWith("/settings") ? "settings" : "home";
const DOCK: [Section, string, IconName, string][] = [["home", "Home", "home", "/"], ["chat", "对话", "chat", "/chat"], ["projects", "项目", "projects", "/projects"]];

export function Root() {
  const [auth, setAuth] = useState<"loading" | "setup" | "login" | "in">("loading");
  const [firstRun, setFirstRun] = useState(false);
  useEffect(() => {
    session.onExpired(() => (qc.clear(), setAuth("login")));
    fetch("/api/auth/status", { headers: { authorization: `Bearer ${session.token}` } })
      .then((r) => r.json())
      .then((s) => setAuth(s.authed ? "in" : s.setup ? "setup" : "login"));
  }, []);
  if (auth === "loading") return null;
  if (auth !== "in") return <Gate setup={auth === "setup"} onDone={(first) => (setFirstRun(first), setAuth("in"))} />;
  return <Shell firstRun={firstRun} />;
}

function Shell({ firstRun }: { firstRun: boolean }) {
  const loc = useLocation();
  const nav = useNavigate();
  const shell = useShell();
  const S = useSettings().data;
  const section = sectionOf(loc.pathname);
  const lastMain = useRef("/");
  const [guideDone, setGuideDone] = useState(false);
  useEffect(() => {
    if (section !== "settings") lastMain.current = loc.href;
  }, [loc.href]);

  const back = () => {
    const parts = loc.pathname.split("/").filter(Boolean); // settings / page / account
    if (parts.length === 3) nav({ to: "/settings/$page", params: { page: parts[1]! } });
    else if (parts.length === 2) nav({ to: "/settings" });
    else nav({ to: lastMain.current });
  };
  const ctx: Record<Section, [IconName, string, () => void]> = {
    home: ["add", "新建面板", () => shell.setNewPanel(true)],
    chat: ["search", "搜索聊天记录", () => shell.setSearch(shell.chat)],
    projects: ["sidebar", "项目列表", () => shell.setDrawer(!shell.drawer)],
    settings: ["back", "返回", back],
  };
  const [cIcon, cTip, cRun] = ctx[section];

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (section !== "chat") nav({ to: "/chat" });
        setTimeout(() => shell.setSearch(shell.chat), 50);
      }
      if (e.key === "Escape" && section === "settings" && !document.querySelector(".scrim, .alertWrap") && !(e.target as HTMLElement).closest?.("input, textarea")) back();
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  });
  const docked = section === "projects" && shell.drawer && innerWidth >= 1100;
  useEffect(() => void document.body.classList.toggle("drawerOpen", docked), [docked]);
  const projectId = section === "projects" ? loc.pathname.split("/")[2] : undefined;
  const showGuide = !!S && !S.onboarded && !guideDone && (firstRun || !hasKey(S) || !(S.profile?.nickname || S.profile?.name));

  return (
    <>
      <header id="bar">
        <Button className="float round" id="ctxBtn" aria-label={cTip} data-tip={cTip} onPress={cRun}><Icon name={cIcon} /></Button>
        <nav className="float dock" id="dock">
          {DOCK.map(([k, label, icon, to]) => (
            <Link key={k} to={to} data-view={k} aria-label={label} className={section === k ? "on" : ""}>
              <Icon name={icon} /><span className="dl">{label}</span>
            </Link>
          ))}
        </nav>
        <Button className={`float round ${section === "settings" ? "on" : ""}`} id="setBtn" aria-label="设置" data-tip="设置" onPress={() => (section === "settings" ? nav({ to: lastMain.current }) : nav({ to: "/settings" }))}>
          <Icon name="settings" />
        </Button>
      </header>
      {section === "projects" && shell.drawer && <Drawer current={projectId} />}
      <main>
        <section className="view on" id={`v-${section}`}>
          {section === "settings" ? <div className="setPage" id="setRoot"><Outlet /></div> : <Outlet />}
        </section>
      </main>
      <NewPanelSheet />
      <SearchSheet />
      <ConfirmHost />
      {showGuide && <Onboarding S={S!} onDone={() => setGuideDone(true)} />}
      <Toast />
    </>
  );
}
