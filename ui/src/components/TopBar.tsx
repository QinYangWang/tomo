// The slim bar at the top of the main pane: list toggle (when the list is hidden, or on phones), title, actions.
import { useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { MenuIcon, SidebarIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { usePhone, useShell } from "../store.tsx";
import { ToolbarButton } from "./parts.tsx";

const WITH_LIST = ["chat", "projects", "settings"];

export function TopBar({ title, sub, onSub, className, lead, children }: { title: ReactNode; sub?: string; onSub?: () => void; className?: string; lead?: ReactNode; children?: ReactNode }) {
  const { toggleSide, side } = useShell();
  const phone = usePhone();
  const hasList = WITH_LIST.includes(useLocation().pathname.split("/")[1] ?? "");
  return (
    <header className={cn("topbar flex h-12 shrink-0 items-center gap-1 border-b border-border px-2", className)}>
      {hasList && (phone || !side) && <ToolbarButton className="tbSide" label="列表" onClick={toggleSide}>{phone ? <MenuIcon /> : <SidebarIcon />}</ToolbarButton>}
      {lead}
      <div className="flex min-w-0 flex-1 items-baseline gap-3 px-1">
        <h1 className="min-w-0 truncate text-ui-lg font-semibold">{title}</h1>
        {sub && !phone && (onSub
          ? <button type="button" id="pLine" className="min-w-0 cursor-pointer truncate text-start text-ui-sm text-muted-foreground transition-colors hover:text-foreground" onClick={onSub}>{sub}</button>
          : <span className="min-w-0 truncate text-ui-sm text-muted-foreground">{sub}</span>)}
      </div>
      <div className="flex items-center gap-0.5">{children}</div>
    </header>
  );
}
