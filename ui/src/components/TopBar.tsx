// The slim bar at the top of the main pane: list toggle (when the list is hidden, or on phones), title, actions.
import { useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useShell } from "../store.tsx";
import { IconBtn } from "./kit.tsx";

const WITH_LIST = ["chat", "projects", "settings"];

export function TopBar({ title, sub, onSub, className = "", lead, children }: { title: ReactNode; sub?: string; onSub?: () => void; className?: string; lead?: ReactNode; children?: ReactNode }) {
  const { toggleSide, side } = useShell();
  const hasList = WITH_LIST.includes(useLocation().pathname.split("/")[1] ?? "");
  return (
    <header className={cn("topbar sticky top-0 z-20 flex h-14 shrink-0 items-center gap-1 border-b border-border bg-background/80 px-3 backdrop-blur-xl desk:px-4", className)}>
      {hasList && <IconBtn className={cn("tbSide", side && "desk:hidden")} icon="sidebar" label="列表" onClick={toggleSide} />}
      {lead}
      <div className="tbTitle flex min-w-0 flex-1 items-baseline gap-3 px-1">
        <h1 className="truncate text-[15px] font-semibold tracking-tight">{title}</h1>
        {sub && (onSub
          ? <button type="button" className="briefLine min-w-0 truncate text-left text-xs text-muted-foreground hover:text-foreground max-desk:hidden" id="pLine" onClick={onSub}>{sub}</button>
          : <span className="briefLine min-w-0 truncate text-xs text-muted-foreground max-desk:hidden">{sub}</span>)}
      </div>
      <div className="tbActions flex items-center gap-0.5">{children}</div>
    </header>
  );
}
