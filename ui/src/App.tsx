// Shell: sign-in gate, then rail · list · main pane on a shell band (the list is a drawer and the rail is the tab bar on phones).
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftIcon } from "@/components/icons";
import { session } from "./api.ts";
import { Gate } from "./components/Gate.tsx";
import { ConfirmHost, ToolbarButton } from "./components/parts.tsx";
import { SearchSheet } from "./components/SearchSheet.tsx";
import { HAS_SIDE, Rail, Sidebar, type Section } from "./components/Sidebar.tsx";
import { TopBar } from "./components/TopBar.tsx";
import { hasKey, qc, useSettings } from "./queries.ts";
import { Onboarding } from "./settings/Onboarding.tsx";
import { isPhone, usePhone, useShell } from "./store.tsx";
import { NewPanelSheet } from "./views/Home.tsx";
import { ScrollArea } from "@/ui/scroll-area";

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
  const phone = usePhone();
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
      if (e.key === "Escape" && section === "settings" && !document.querySelector("[role=dialog], [role=alertdialog], [role=menu]") && !(e.target as HTMLElement).closest?.("input, textarea")) back();
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
  const onSettings = () => (section === "settings" ? nav({ to: lastMain.current }) : nav({ to: "/settings" }));

  const view = (
    <section className="flex min-h-0 flex-1 flex-col" id={`v-${section}`}>
      {section === "settings" ? (
        <>
          <TopBar title="设置" lead={parts.length > 2 || (parts.length > 1 && phone) ? <ToolbarButton id="backBtn" label="返回" onClick={back}><ArrowLeftIcon /></ToolbarButton> : undefined} />
          <ScrollArea className="min-h-0 flex-1">
            <div id="setRoot" className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 pt-8 pb-24 md:px-8"><Outlet /></div>
          </ScrollArea>
        </>
      ) : <Outlet />}
    </section>
  );

  return (
    <>
      {phone ? (
        <div id="app" className="flex h-dvh w-full flex-col overflow-hidden bg-shell text-foreground">
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-shell bg-background">{view}</main>
          <div className="shrink-0 pb-[env(safe-area-inset-bottom)]"><Rail section={section} onSettings={onSettings} /></div>
          <Sidebar section={section} current={projectId} page={page} />
        </div>
      ) : (
        <div id="app" className="flex h-dvh w-full overflow-hidden bg-shell text-foreground">
          <Rail section={section} onSettings={onSettings} />
          <Sidebar section={section} current={projectId} page={page} />
          <main className="shell-inset mt-0.75 flex min-w-0 flex-1 flex-col overflow-hidden">{view}</main>
        </div>
      )}
      <NewPanelSheet />
      <SearchSheet />
      <ConfirmHost />
      {showGuide && <Onboarding S={S!} onDone={() => setGuideDone(true)} />}
    </>
  );
}
