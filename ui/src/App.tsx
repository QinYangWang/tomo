// Shell: sign-in gate, then rail · sidebar · main pane (Synara-style three columns; the sidebar is a drawer on phones).
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components";
import { session } from "./api.ts";
import { ConfirmHost } from "./components/Sheet.tsx";
import { Gate } from "./components/Gate.tsx";
import { SearchSheet } from "./components/SearchSheet.tsx";
import { Toast } from "./components/Toast.tsx";
import { Icon } from "./icons.tsx";
import { HAS_SIDE, Rail, Sidebar, type Section } from "./components/Sidebar.tsx";
import { TopBar } from "./components/TopBar.tsx";
import { hasKey, qc, useSettings } from "./queries.ts";
import { Onboarding } from "./settings/Onboarding.tsx";
import { isPhone, useShell } from "./store.tsx";
import { NewPanelSheet } from "./views/Home.tsx";

const sectionOf = (path: string): Section => {
  const s = path.split("/")[1] ?? "";
  return (["chat", "projects", "schedules", "memory", "skills", "settings"] as const).find((k) => k === s) ?? "home";
};

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
  const parts = loc.pathname.split("/").filter(Boolean);
  const lastMain = useRef("/");
  const [guideDone, setGuideDone] = useState(false);
  useEffect(() => {
    if (section !== "settings") lastMain.current = loc.href;
    shell.closeMobileSide();
  }, [loc.href]);

  const back = () => {
    if (parts.length === 3) nav({ to: "/settings/$page", params: { page: parts[1]! } });
    else if (parts.length === 2 && isPhone()) nav({ to: "/settings" });
    else nav({ to: lastMain.current });
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        shell.setSearch(shell.chat);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "b") (e.preventDefault(), shell.toggleSide());
      if (e.key === "Escape" && section === "settings" && !document.querySelector(".scrim, .alertWrap") && !(e.target as HTMLElement).closest?.("input, textarea")) back();
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  });
  useEffect(() => {
    document.body.classList.toggle("sideClosed", !shell.side);
    document.body.classList.toggle("sideMobile", shell.sideMobile);
    document.body.classList.toggle("noSide", !HAS_SIDE.includes(section));
  }, [shell.side, shell.sideMobile, section]);
  const projectId = section === "projects" ? parts[1] : undefined;
  const page = section === "settings" ? parts[1] : undefined;
  const showGuide = !!S && !S.onboarded && !guideDone && (firstRun || !hasKey(S) || !(S.profile?.nickname || S.profile?.name));

  return (
    <div id="app">
      <Rail section={section} onSettings={() => (section === "settings" ? nav({ to: lastMain.current }) : nav({ to: "/settings" }))} />
      <Sidebar section={section} current={projectId} page={page} />
      <main>
        <section className="view on" id={`v-${section}`}>
          {section === "settings" ? (
            <>
              <TopBar title="设置" lead={parts.length > 2 || (parts.length > 1 && isPhone()) ? <Button className="icon" id="backBtn" aria-label="返回" onPress={back}><Icon name="back" size={18} /></Button> : undefined} />
              <div className="setScroll"><div className="setPage" id="setRoot"><Outlet /></div></div>
            </>
          ) : <Outlet />}
        </section>
      </main>
      <NewPanelSheet />
      <SearchSheet />
      <ConfirmHost />
      {showGuide && <Onboarding S={S!} onDone={() => setGuideDone(true)} />}
      <Toast />
    </div>
  );
}
