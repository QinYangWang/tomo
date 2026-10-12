// The app's controls, built on beUI parts (components/motion, components/agents).
// Class names like "primary", "icon", "pop", "mi" are only stable hooks for tests; the look is beUI's.
import { forwardRef, useState, type ReactNode } from "react";
import { Button as BeButton, type ButtonProps as BeButtonProps } from "@/components/motion/button";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger } from "@/components/motion/combobox";
import { Input } from "@/components/motion/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/motion/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/motion/popover";
import { Switch } from "@/components/motion/switch";
import { Tooltip } from "@/components/motion/tooltip";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "../icons.tsx";

type Kind = "primary" | "ghost" | "secondary" | "danger" | "link";
export type BtnProps = Omit<BeButtonProps, "variant"> & { kind?: Kind; big?: boolean };

/** Text button. `kind` picks the beUI variant; danger is a quiet red outline. */
export const Btn = forwardRef<HTMLButtonElement, BtnProps>(function Btn({ kind = "primary", big, size, className, ...p }, ref) {
  const variant = kind === "primary" ? "primary" : kind === "secondary" ? "secondary" : kind === "danger" ? "outline" : "ghost";
  return (
    <BeButton
      ref={ref}
      type="button"
      variant={variant}
      size={size ?? (big ? "lg" : kind === "danger" || kind === "link" ? "sm" : "md")}
      className={cn(
        kind,
        kind === "danger" && "dangerBtn border-destructive/30 text-destructive hover:bg-destructive/10",
        kind === "link" && "linkBtn text-muted-foreground hover:bg-transparent hover:text-foreground",
        big && "w-full",
        "disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
        className,
      )}
      {...p}
    />
  );
});

/** Icon-only button with a beUI tooltip carrying its label. */
export const IconBtn = forwardRef<HTMLButtonElement, Omit<BeButtonProps, "children" | "size"> & { icon: IconName; label: string; size?: number; tip?: boolean; side?: "top" | "bottom" | "left" | "right" }>(
  function IconBtn({ icon, label, size = 18, tip = true, side = "bottom", className, ...p }, ref) {
    const b = (
      <BeButton ref={ref} type="button" variant="ghost" size="icon" aria-label={label} className={cn("icon", className)} {...p}>
        <Icon name={icon} size={size} />
      </BeButton>
    );
    return tip ? <Tooltip content={label} side={side}>{b}</Tooltip> : b;
  },
);

/** On/off switch. */
export function Toggle({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label: string; className?: string }) {
  return <Switch checked={checked} onCheckedChange={onChange} ariaLabel={label} className={cn("toggle", className)} />;
}

/** Labeled text field (label above). */
export function Field({ label, hint, value, onChange, ...p }: { label?: ReactNode; hint?: ReactNode; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "defaultValue">) {
  return (
    <div className="field flex flex-col gap-2 px-4 py-3">
      {label && <label className="flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">{label}</label>}
      <Input value={value} onChange={onChange} classNames={{ field: "bg-background" }} {...(p as object)} />
      {hint && <span className="px-1 text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
export { Input };

export type MenuEntry = { id: string; label: string; icon: IconName; danger?: boolean };
/** A "⋯" button that opens a beUI popover with a list of actions. */
export function ActionMenu({ items, onAction, trigger, align = "end", className }: { items: MenuEntry[]; onAction: (id: string) => void; trigger: ReactNode; align?: "start" | "center" | "end"; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover className={className} open={open} onOpenChange={setOpen} side="bottom" align={align} sideOffset={8} panelRadius={14}>
      <PopoverTrigger>{trigger as React.ReactElement}</PopoverTrigger>
      <PopoverContent className="pop p-1.5 min-w-40">
        {/* beUI keeps the panel mounted while closed; render the items only when open so closed menus hold nothing clickable. */}
        {open && <div role="menu" className="flex flex-col">
          {items.map((it) => (
            <button
              key={it.id} role="menuitem" type="button"
              className={cn("mi flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-sm hover:bg-muted", it.danger && "danger text-destructive")}
              onClick={() => (setOpen(false), onAction(it.id))}
            >
              <Icon name={it.icon} size={16} />{it.label}
            </button>
          ))}
        </div>}
      </PopoverContent>
    </Popover>
  );
}

export type PickOption = { value: string; label: string };
/** Dropdown: beUI select, or beUI combobox when the list is long enough to want typing (`search`). */
export function Pick({ value, onChange, options, label, search }: { value: string; onChange: (v: string) => void; options: PickOption[]; label: string; search?: boolean }) {
  if (search)
    return (
      <Combobox value={value || undefined} onValueChange={onChange} className="pick min-w-0">
        <ComboboxTrigger className="min-w-0 bg-background"><ComboboxInput aria-label={label} placeholder="搜索模型" /></ComboboxTrigger>
        <ComboboxContent className="max-h-80 overflow-auto">
          <ComboboxList>
            {options.map((o) => <ComboboxItem key={o.value} value={o.value} textValue={o.label} keywords={[o.value]}>{o.label}</ComboboxItem>)}
            <ComboboxEmpty>没有找到</ComboboxEmpty>
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    );
  return (
    <Select value={value || undefined} onValueChange={onChange} className="pick min-w-0">
      <SelectTrigger className="bg-background"><span aria-label={label} className="min-w-0 truncate"><SelectValue placeholder="选择" /></span></SelectTrigger>
      <SelectContent className="max-h-80 overflow-auto">{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}
