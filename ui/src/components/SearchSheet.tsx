// Full-text search over the current conversation; picking a hit scrolls to it if it is on screen.
import { useEffect, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { EmptyState, EmptyStateDescription } from "@/ui/empty-state";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/ui/input-group";
import { SettingsGroup, SettingsRowDescription, SettingsRowText, SettingsRowTitle } from "@/ui/settings-section";
import { api, enc } from "../api.ts";
import { esc, when } from "../lib.ts";
import { toast, useShell } from "../store.tsx";
import type { Hit } from "../types.ts";
import { LinkRow, Sheet } from "./parts.tsx";

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
    el.animate([{ backgroundColor: "color-mix(in oklch, var(--primary) 18%, transparent)" }, { backgroundColor: "transparent" }], { duration: 1800, easing: "ease-out" });
  };
  return (
    <Sheet open={!!search} onClose={() => setSearch(null)} title={`搜索「${search?.label ?? ""}」`}>
      <InputGroup>
        <InputGroupAddon><SearchIcon /></InputGroupAddon>
        <InputGroupInput id="hq" autoFocus placeholder="输入要找的字" aria-label="搜索" value={q} onChange={(e) => setQ(e.target.value)} />
      </InputGroup>
      {hits && (hits.length ? (
        <SettingsGroup id="hits">
          {hits.map((h) => (
            <LinkRow key={h.entryId} className="hit" chevron={false} onClick={() => jump(h.entryId)}>
              <SettingsRowText>
                <SettingsRowDescription>{h.role === "user" ? "你" : "Tomo"}{h.at ? ` · ${when(h.at)}` : ""}</SettingsRowDescription>
                <SettingsRowTitle className="font-normal"><span className="text-pretty [&_mark]:rounded-xs [&_mark]:bg-warning-subtle [&_mark]:text-foreground" dangerouslySetInnerHTML={{ __html: mark(h.text) }} /></SettingsRowTitle>
              </SettingsRowText>
            </LinkRow>
          ))}
        </SettingsGroup>
      ) : <EmptyState size="sm"><EmptyStateDescription>没找到「{q}」</EmptyStateDescription></EmptyState>)}
    </Sheet>
  );
}
