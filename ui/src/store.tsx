// App-wide bits that are not server state: toasts, confirm dialogs, and the shell's open/closed flags.
import { Toast } from "@base-ui/react/toast";
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

/** One toast queue for the whole app, so `toast("…")` works outside React too. */
export const toastManager = Toast.createToastManager();
export function toast(text: string) {
  toastManager.add({ title: text, type: "success" });
}

export type ConfirmReq = { title: string; body: string; confirm?: string; cancel?: string; danger?: boolean; resolve: (ok: boolean) => void };
export const confirmSignal = signal<ConfirmReq | null>(null);
export const confirmDialog = (o: Omit<ConfirmReq, "resolve">) => new Promise<boolean>((resolve) => confirmSignal.set({ ...o, resolve }));

/** Shell state shared by the rail, the sidebar, the top bars and the views they act on. */
type Shell = {
  newPanel: boolean;
  setNewPanel: (v: boolean) => void;
  search: { conv: string; label: string } | null;
  setSearch: (v: { conv: string; label: string } | null) => void;
  chat: { conv: string; label: string };
  setChat: (v: { conv: string; label: string }) => void;
  /** desktop: sidebar docked open (remembered) */
  side: boolean;
  /** phone: sidebar drawer open */
  sideMobile: boolean;
  toggleSide: () => void;
  closeMobileSide: () => void;
  renaming: string | null;
  setRenaming: (id: string | null) => void;
};
const Ctx = createContext<Shell>(null!);
export const useShell = () => useContext(Ctx);
/** Phones and narrow windows get bottom tabs and a drawer instead of the rail and sidebar (below `md`). */
export const PHONE_QUERY = "(max-width: 767.98px)";
export const isPhone = () => matchMedia(PHONE_QUERY).matches;
export function usePhone() {
  const [phone, setPhone] = useState(isPhone);
  useEffect(() => {
    const m = matchMedia(PHONE_QUERY);
    const on = () => setPhone(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return phone;
}

export function ShellProvider({ children }: { children: ReactNode }) {
  const [newPanel, setNewPanel] = useState(false);
  const [search, setSearch] = useState<Shell["search"]>(null);
  const [chat, setChat] = useState({ conv: "home", label: "私聊" });
  const [side, setSide] = useState(() => localStorage.side !== "");
  const [sideMobile, setSideMobile] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const toggleSide = () => {
    if (isPhone()) return setSideMobile((v) => !v);
    localStorage.side = side ? "" : "1";
    setSide(!side);
  };
  const closeMobileSide = () => setSideMobile(false);
  return (
    <Ctx.Provider value={{ newPanel, setNewPanel, search, setSearch, chat, setChat, side, sideMobile, toggleSide, closeMobileSide, renaming, setRenaming }}>
      {children}
    </Ctx.Provider>
  );
}
