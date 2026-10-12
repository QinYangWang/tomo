// Full-text search over the current conversation; picking a hit scrolls to it if it is on screen.
import { Input } from "./kit.tsx";
import { Icon } from "../icons.tsx";
import { useEffect, useState } from "react";
import { api, enc } from "../api.ts";
import { esc, when } from "../lib.ts";
import { toast, useShell } from "../store.tsx";
import type { Hit } from "../types.ts";
import { Sheet } from "./Sheet.tsx";

export function SearchSheet() {
  const { search, setSearch } = useShell();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  useEffect(() => {
    setQ("");
    setHits(null);
  }, [search]);
  useEffect(() => {
    if (!search || !q.trim()) return setHits(null);
    const t = setTimeout(async () => setHits(await api<Hit[]>(`/api/history?q=${enc(q.trim())}&conversation=${enc(search.conv)}`)), 250);
    return () => clearTimeout(t);
  }, [q, search]);
  const mark = (s: string) => {
    const plain = s.replace(/[*_`#>]+/g, "").replace(/\s+/g, " ");
    const cut = plain.length > 220 ? plain.slice(0, 220) + "…" : plain;
    return esc(cut).replace(new RegExp(esc(q.trim()).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (m) => `<mark>${m}</mark>`);
  };
  const jump = (id: string) => {
    setSearch(null);
    const el = document.querySelector<HTMLElement>(`#log [data-entry="${CSS.escape(id)}"]`);
    if (!el) return toast("这条太早了，页面上没有显示");
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.animate([{ backgroundColor: "color-mix(in oklch, var(--primary) 18%, transparent)", borderRadius: "16px" }, { backgroundColor: "transparent", borderRadius: "16px" }], { duration: 1800, easing: "ease-out" });
  };
  return (
    <Sheet open={!!search} onClose={() => setSearch(null)} title={`搜索「${search?.label ?? ""}」`}>
      <Input className="searchBox" id="hq" autoFocus placeholder="输入要找的字" value={q} onChange={setQ} leftIcon={<Icon name="search" size={16} />} classNames={{ field: "bg-background", input: "pl-9" }} />
      {hits && (hits.length ? (
        <div className="group mt-4 flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {hits.map((h) => (
            <button key={h.entryId} type="button" className="hit px-4 py-3 text-left text-sm transition-colors hover:bg-foreground/[0.03]" onClick={() => jump(h.entryId)}>
              <div className="who mb-0.5 text-xs text-muted-foreground">{h.role === "user" ? "你" : "Tomo"}{h.at ? ` · ${when(h.at)}` : ""}</div>
              <div className="leading-6 [&_mark]:rounded [&_mark]:bg-warning/40 [&_mark]:px-0.5 [&_mark]:text-foreground" dangerouslySetInnerHTML={{ __html: mark(h.text) }} />
            </button>
          ))}
        </div>
      ) : <div className="empty py-10 text-center text-sm text-muted-foreground">没找到「{q}」</div>)}
    </Sheet>
  );
}
