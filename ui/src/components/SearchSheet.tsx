// Full-text search over the current conversation; picking a hit scrolls to it if it is on screen.
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
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
  };
  return (
    <Sheet open={!!search} onClose={() => setSearch(null)} title={`搜索「${search?.label ?? ""}」`}>
      <input className="searchBox" id="hq" autoFocus placeholder="输入要找的字" value={q} onChange={(e) => setQ(e.target.value)} />
      {hits && (hits.length ? (
        <div className="group">
          {hits.map((h) => (
            <button key={h.entryId} className="hit" onClick={() => jump(h.entryId)}>
              <div className="who">{h.role === "user" ? "你" : "Tomo"}{h.at ? ` · ${when(h.at)}` : ""}</div>
              <div dangerouslySetInnerHTML={{ __html: mark(h.text) }} />
            </button>
          ))}
        </div>
      ) : <div className="empty">没找到「{q}」</div>)}
    </Sheet>
  );
}
