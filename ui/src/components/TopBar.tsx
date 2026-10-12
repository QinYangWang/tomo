// The slim bar at the top of the main pane: sidebar toggle (when the sidebar is hidden or on phones), title, actions.
import type { ReactNode } from "react";
import { IconBtn } from "./kit.tsx";
import { useShell } from "../store.tsx";

export function TopBar({ title, sub, onSub, className = "", lead, children }: { title: ReactNode; sub?: string; onSub?: () => void; className?: string; lead?: ReactNode; children?: ReactNode }) {
  const { toggleSide } = useShell();
  return (
    <header className={`topbar ${className}`}>
      <IconBtn className="tbSide" icon="sidebar" label="列表" onClick={toggleSide} />
      {lead}
      <div className="tbTitle">
        <h1>{title}</h1>
        {sub && (onSub ? <button className="briefLine" id="pLine" onClick={onSub}><span>{sub}</span></button> : <span className="briefLine"><span>{sub}</span></span>)}
      </div>
      <div className="tbActions">{children}</div>
    </header>
  );
}
