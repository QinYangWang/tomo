// Layout primitives in beUI's own look (cards on bg-card, hairline borders, muted labels), written as Tailwind utilities.
// Lower-case class names such as "group", "item", "badge ok" are kept only as stable hooks for tests.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "../icons.tsx";

/** Rendered markdown (assistant replies, panel bodies, briefs). */
export const PROSE =
  "text-[15px] leading-7 text-foreground [&_p]:my-0 [&_p+p]:mt-3 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 " +
  "[&_h4]:mt-4 [&_h4]:mb-1 [&_h4]:text-base [&_h4]:font-semibold [&_h4:first-child]:mt-0 [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline " +
  "[&_strong]:font-semibold [&_code]:rounded-md [&_code]:bg-foreground/[0.06] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] " +
  "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border [&_pre]:bg-card [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0";

export const Md = ({ html, className }: { html: string; className?: string }) => <div className={cn(PROSE, className)} dangerouslySetInnerHTML={{ __html: html }} />;

/** A rounded card holding rows separated by hairlines. */
export function Group({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return <div id={id} className={cn("group flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card", className)}>{children}</div>;
}

const ROW = "item flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left text-sm text-foreground";
const HOVER = "transition-colors hover:bg-foreground/[0.03] active:bg-foreground/[0.05]";
type RowProps = { children: ReactNode; className?: string; id?: string; [k: `data-${string}`]: string | undefined };
export const Row = ({ children, className, ...p }: RowProps) => <div className={cn(ROW, className)} {...p}>{children}</div>;
export const RowButton = ({ children, className, onClick, ...p }: RowProps & { onClick: () => void }) => (
  <button type="button" onClick={onClick} className={cn(ROW, HOVER, className)} {...p}>{children}</button>
);
export const RowLink = ({ children, className, href }: { children: ReactNode; className?: string; href: string }) => (
  <a href={href} target="_blank" rel="noopener" className={cn(ROW, HOVER, className)}>{children}</a>
);
/** Label on the left, a bare input on the right. */
export function KV({ label, className, ...input }: { label: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={cn(ROW, "kv cursor-text")}>
      <span className="k w-16 shrink-0 text-muted-foreground">{label}</span>
      <input {...input} className={cn("min-w-0 flex-1 bg-transparent text-right outline-none placeholder:text-muted-foreground/60", className)} />
    </label>
  );
}
/** Free-form area inside a group (fields, buttons). */
export const Pad = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cn("field flex flex-col gap-2 px-4 py-3", className)}>{children}</div>;
export const Btns = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cn("btns flex flex-wrap items-center gap-2", className)}>{children}</div>;
export const Grow = ({ children, className }: { children?: ReactNode; className?: string }) => <span className={cn("grow min-w-0 flex-1", className)}>{children}</span>;
export const Sub = ({ children }: { children: ReactNode }) => <div className="mt-0.5 text-xs text-muted-foreground">{children}</div>;

export const SectionTitle = ({ children }: { children: ReactNode }) => <div className="gtitle px-1 pt-7 pb-2 text-xs font-medium tracking-wide text-muted-foreground">{children}</div>;
export const Note = ({ children, className }: { children: ReactNode; className?: string }) => <p className={cn("note px-1 pt-2.5 text-xs leading-5 text-muted-foreground", className)}>{children}</p>;

type Tone = "ok" | "err" | "";
const TONE = { ok: "bg-success/15 text-success", err: "bg-destructive/12 text-destructive", "": "bg-foreground/[0.06] text-muted-foreground" };
export const Badge = ({ tone = "", children }: { tone?: Tone; children: ReactNode }) => (
  <span className={cn("badge inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium", tone, TONE[tone])}>{children}</span>
);
export const Pill = ({ children }: { children: ReactNode }) => <span className="pillBtn shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{children}</span>;
export type Flash = { text: string; ok: boolean } | null;
export const Msg = ({ m }: { m: Flash }) => (m ? <span className={cn("msg text-xs", m.ok ? "ok text-success" : "err text-destructive")}>{m.text}</span> : null);
export const Chevron = () => <span className="arrow shrink-0 text-muted-foreground/60"><Icon name="right" size={16} /></span>;
export const Logo = ({ children }: { children: ReactNode }) => <span className="logo grid size-8 shrink-0 place-items-center rounded-lg bg-background text-sm font-semibold text-foreground ring-1 ring-border">{children}</span>;

/** Big empty state used by the tool pages and Home. */
export function Empty({ icon, title, sub, children }: { icon: Parameters<typeof Icon>[0]["name"]; title: string; sub: string; children?: ReactNode }) {
  return (
    <div className="toolEmpty flex flex-col items-center gap-2 rounded-3xl border border-dashed border-border-strong px-6 py-16 text-center">
      <span className="mb-1 grid size-12 place-items-center rounded-2xl bg-card text-muted-foreground ring-1 ring-border"><Icon name={icon} size={24} /></span>
      <b className="text-sm font-semibold">{title}</b>
      <span className="text-sm text-muted-foreground">{sub}</span>
      {children}
    </div>
  );
}

/** Page header for the full-width pages. */
export function PageHead({ title, desc, className }: { title: string; desc?: string; className?: string }) {
  return (
    <header className={cn("toolHead mb-6", className)}>
      <h1 className="text-[28px] font-semibold tracking-tight text-balance">{title}</h1>
      {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
    </header>
  );
}

/** Scrolling content column. */
export const Page = ({ children, narrow, id, className }: { children: ReactNode; narrow?: boolean; id?: string; className?: string }) => (
  <div className="scroll min-h-0 flex-1 overflow-y-auto">
    <div id={id} className={cn("page mx-auto w-full px-5 pt-10 pb-24 desk:px-8", narrow ? "max-w-2xl" : "max-w-5xl", className)}>{children}</div>
  </div>
);
