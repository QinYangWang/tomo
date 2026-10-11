// App-wide bits that are not server state: toasts, confirm dialogs, and the shell's open/closed flags.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Listener = () => void;
function signal<T>(initial: T) {
  let v = initial;
  const ls = new Set<Listener>();
  return {
    get: () => v,
    set: (n: T) => {
      v = n;
      ls.forEach((l) => l());
    },
    use(): T {
      const [, f] = useState(0);
      useEffect(() => {
        const l = () => f((x) => x + 1);
        ls.add(l);
        return () => void ls.delete(l);
      }, []);
      return v;
    },
  };
}

export const toastSignal = signal<{ text: string; n: number } | null>(null);
let tt: ReturnType<typeof setTimeout>;
export function toast(text: string) {
  toastSignal.set({ text, n: Date.now() });
  clearTimeout(tt);
  tt = setTimeout(() => toastSignal.set(null), 2200);
}

export type ConfirmReq = { title: string; body: string; confirm?: string; cancel?: string; danger?: boolean; resolve: (ok: boolean) => void };
export const confirmSignal = signal<ConfirmReq | null>(null);
export const confirmDialog = (o: Omit<ConfirmReq, "resolve">) => new Promise<boolean>((resolve) => confirmSignal.set({ ...o, resolve }));

/** Shell state shared by the top bar's context button and the views it acts on. */
type Shell = {
  newPanel: boolean;
  setNewPanel: (v: boolean) => void;
  search: { conv: string; label: string } | null;
  setSearch: (v: { conv: string; label: string } | null) => void;
  chat: { conv: string; label: string };
  setChat: (v: { conv: string; label: string }) => void;
  drawer: boolean;
  setDrawer: (v: boolean, remember?: boolean) => void;
  renaming: string | null;
  setRenaming: (id: string | null) => void;
};
const Ctx = createContext<Shell>(null!);
export const useShell = () => useContext(Ctx);
const wide = () => innerWidth >= 1100;

export function ShellProvider({ children }: { children: ReactNode }) {
  const [newPanel, setNewPanel] = useState(false);
  const [search, setSearch] = useState<Shell["search"]>(null);
  const [chat, setChat] = useState({ conv: "home", label: "Home" });
  const [drawer, setDrawerState] = useState(() => wide() && localStorage.drawer !== "");
  const [renaming, setRenaming] = useState<string | null>(null);
  const setDrawer = (v: boolean, remember = true) => {
    setDrawerState(v);
    if (remember && wide()) localStorage.drawer = v ? "1" : "";
  };
  return <Ctx.Provider value={{ newPanel, setNewPanel, search, setSearch, chat, setChat, drawer, setDrawer, renaming, setRenaming }}>{children}</Ctx.Provider>;
}
