// Small compositions of qinyang/ui parts that several screens share. Nothing here restyles a library component.
import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BottomSheet, BottomSheetBody, BottomSheetContent, BottomSheetHeader, BottomSheetTitle } from "@/ui/bottom-sheet";
import { Button } from "@/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/ui/alert-dialog";
import { PageHeader, PageHeaderContent, PageHeaderDescription, PageHeaderTitle } from "@/ui/page-header";
import { ScrollArea } from "@/ui/scroll-area";
import { SettingsGroup, SettingsRow, SettingsSection, SettingsSectionHeader, SettingsSectionTitle } from "@/ui/settings-section";
import { ChevronRightIcon } from "@/components/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui/tooltip";
import { confirmSignal, usePhone } from "../store.tsx";

/** Icon-only toolbar button with its label in a tooltip (the label is also its accessible name). */
export function ToolbarButton({ label, children, tip = true, side = "bottom", ...p }: Omit<React.ComponentProps<typeof Button>, "aria-label" | "children"> & { label: string; children: ReactElement; tip?: boolean; side?: "top" | "bottom" | "left" | "right" }) {
  const b = <Button type="button" variant="ghost" size="icon-sm" aria-label={label} {...p}>{children}</Button>;
  if (!tip) return b;
  return (
    <Tooltip>
      <TooltipTrigger render={b} />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}

/** A modal: a dialog on wide screens, a bottom sheet on phones. `.sheet` marks its body for tests. */
export function Sheet({ open, onClose, title, small, children }: { open: boolean; onClose: () => void; title: string; small?: boolean; children: ReactNode }) {
  const phone = usePhone();
  if (phone)
    return (
      <BottomSheet open={open} onOpenChange={(o) => !o && onClose()} snapPoints={[0.92]}>
        <BottomSheetContent>
          <BottomSheetHeader><BottomSheetTitle>{title}</BottomSheetTitle></BottomSheetHeader>
          <BottomSheetBody><div className="sheet flex flex-col gap-4 pb-6">{children}</div></BottomSheetBody>
        </BottomSheetContent>
      </BottomSheet>
    );
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={small ? undefined : "max-w-xl"}>
        <DialogHeader><DialogTitle className="truncate">{title}</DialogTitle></DialogHeader>
        <div className="sheet flex flex-col gap-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

/** Answers confirmDialog(); keeps the words on screen while the dialog closes. */
export function ConfirmHost() {
  const req = confirmSignal.use();
  const [last, setLast] = useState(req);
  useEffect(() => void (req && setLast(req)), [req]);
  const r = req ?? last;
  const done = (ok: boolean) => {
    if (!req || confirmSignal.get() !== req) return;
    req.resolve(ok);
    confirmSignal.set(null);
  };
  return (
    // A button's own click answers first; closing any other way (Esc) counts as cancel.
    <AlertDialog open={!!req} onOpenChange={(o) => !o && setTimeout(() => done(false), 0)}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{r?.title}</AlertDialogTitle>
          <AlertDialogDescription>{r?.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => done(false)}>{r?.cancel ?? "取消"}</AlertDialogCancel>
          <AlertDialogAction variant={r?.danger ? "destructive" : "default"} onClick={() => done(true)}>{r?.confirm ?? "确定"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** One line of feedback after an action ("能用 ✓", an error). `.msg.ok` / `.msg.err` are test hooks. */
export type Flash = { text: string; ok: boolean } | null;
export const Msg = ({ m, id }: { m: Flash; id?: string }) =>
  m ? <span id={id} role="status" className={cn("msg text-ui-sm", m.ok ? "ok text-success" : "err text-destructive")}>{m.text}</span> : null;

/** The scrolling content column of a full-width page. */
export function Page({ children, narrow, id }: { children: ReactNode; narrow?: boolean; id?: string }) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div id={id} className={cn("mx-auto flex w-full flex-col gap-6 px-5 pt-8 pb-24 md:px-8", narrow ? "max-w-2xl" : "max-w-5xl")}>{children}</div>
    </ScrollArea>
  );
}

/** Title and one line of description at the top of a page. */
export function Head({ title, desc }: { title: ReactNode; desc?: ReactNode }) {
  return (
    <PageHeader>
      <PageHeaderContent>
        <PageHeaderTitle>{title}</PageHeaderTitle>
        {desc && <PageHeaderDescription>{desc}</PageHeaderDescription>}
      </PageHeaderContent>
    </PageHeader>
  );
}

/** Numbered how-to steps inside a settings group. */
export const Steps = ({ items }: { items: ReactNode[] }) => (
  <ol className="flex list-decimal flex-col gap-1.5 ps-5 text-ui text-pretty text-muted-foreground marker:text-muted-foreground">
    {items.map((s, i) => <li key={i}>{s}</li>)}
  </ol>
);

/** A titled settings block: title, the grouped rows, then a short note under them. */
export function Section({ title, note, children, id }: { title?: ReactNode; note?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <SettingsSection>
      {title && <SettingsSectionHeader><SettingsSectionTitle>{title}</SettingsSectionTitle></SettingsSectionHeader>}
      <SettingsGroup id={id}>{children}</SettingsGroup>
      {note && <p className="note px-1 text-ui-sm text-pretty text-muted-foreground">{note}</p>}
    </SettingsSection>
  );
}

/**
 * A settings row that opens something: the whole row is the button (or link), with a chevron at the end.
 * TODO(qinyang-gap): SettingsRow has no interactive variant (hover/press fill, focus ring, trailing chevron); this composes one from SettingsRow + tokens.
 */
export function LinkRow({ children, onClick, href, chevron = true, className, ...p }: { children: ReactNode; onClick?: () => void; href?: string; chevron?: boolean; className?: string; [k: `data-${string}`]: string | undefined }) {
  return (
    <SettingsRow
      className={cn("cursor-pointer flex-nowrap text-start transition-colors duration-150 outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset active:bg-foreground/6", className)}
      render={href ? <a href={href} target="_blank" rel="noopener" /> : <button type="button" onClick={onClick} />}
      {...p}
    >
      {children}
      {chevron && <ChevronRightIcon className="shrink-0 text-muted-foreground" />}
    </SettingsRow>
  );
}
