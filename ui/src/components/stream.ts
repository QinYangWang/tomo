// One conversation's live transcript over the WebSocket: a snapshot first, then Pi Durable agent events.
import { useEffect, useReducer, useRef } from "react";
import { session } from "../api.ts";
import { toolLabel } from "../lib.ts";
import { toast } from "../store.tsx";

export type Item = { k: "me" | "ai"; text: string; id?: string } | { k: "work"; steps: string[]; done: boolean };
type State = { items: Item[]; typing: boolean; loaded: boolean; live: number | null; work: number | null };

const textOf = (msgs: any[]) =>
  (msgs ?? []).flatMap((m) => (typeof m.content === "string" ? [m.content] : (m.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text))).join("");

export function useStream(conv: string | undefined) {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const s = useRef<State>({ items: [], typing: false, loaded: false, live: null, work: null });
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!conv) return;
    let disposed = false;
    const st = s.current;
    Object.assign(st, { items: [], typing: false, loaded: false, live: null, work: null });
    bump();
    const finishWork = () => {
      if (st.work === null) return;
      (st.items[st.work] as Extract<Item, { k: "work" }>).done = true;
      st.work = null;
    };
    const step = (label: string) => {
      if (st.work === null) st.work = st.items.push({ k: "work", steps: [], done: false }) - 1;
      (st.items[st.work] as Extract<Item, { k: "work" }>).steps.push(label);
    };
    const bubble = (k: "me" | "ai", text: string, id?: string) => st.items.push({ k, text, id }) - 1;
    const entry = (e: any, fromSnapshot = false) => {
      if (e.kind === "pi.user") {
        finishWork();
        bubble("me", textOf(e.model), String(e.id));
      } else if (e.kind === "pi.assistant") {
        if (fromSnapshot) for (const m of e.model ?? []) for (const c of m.content ?? []) if (c.type === "toolCall") step(toolLabel(c.name, c.arguments));
        const t = textOf(e.model);
        if (t) {
          finishWork();
          bubble("ai", t, String(e.id));
        }
      }
    };
    const open = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const sock = (ws.current = new WebSocket(`${proto}://${location.host}/ws?conversation=${encodeURIComponent(conv)}&token=${encodeURIComponent(session.token)}`));
      sock.onmessage = (ev) => {
        for (const e of JSON.parse(ev.data)) {
          if (e.type === "snapshot") {
            Object.assign(st, { items: [], typing: false, live: null, work: null, loaded: true });
            e.entries.forEach((x: any) => entry(x, true));
            finishWork();
          } else if (e.type === "run_start") st.typing = true;
          else if (e.type === "message_start" && e.message?.role === "assistant") st.live = null;
          else if (e.type === "message_update") {
            for (const c of e.changes ?? [])
              if (c.type === "text_delta") {
                if (st.live === null) {
                  st.typing = false;
                  finishWork();
                  st.live = bubble("ai", "");
                }
                (st.items[st.live] as { text: string }).text += c.delta;
              }
          } else if (e.type === "message_end") {
            if (e.entry?.kind === "pi.user") entry(e.entry);
            else if (e.entry?.kind === "pi.assistant") {
              const t = textOf(e.entry.model);
              if (st.live !== null) Object.assign(st.items[st.live]!, { text: t, id: String(e.entry.id) });
              else if (t) {
                st.typing = false;
                finishWork();
                bubble("ai", t, String(e.entry.id));
              }
            }
            st.live = null;
          } else if (e.type === "tool_execution_start") {
            step(toolLabel(e.toolName, e.args));
            st.typing = true;
          } else if (e.type === "auto_retry_start") toast(`模型出错，正在重试：${String(e.errorMessage).slice(0, 80)}`);
          else if (e.type === "run_end") {
            st.typing = false;
            finishWork();
          }
        }
        bump();
      };
      sock.onclose = (ev) => {
        if (disposed) return;
        if (ev.code === 4401) return location.reload();
        setTimeout(() => !disposed && open(), 2000);
      };
    };
    open();
    return () => {
      disposed = true;
      ws.current?.close();
    };
  }, [conv]);

  const send = (text: string) => {
    if (ws.current?.readyState !== 1) return false;
    ws.current.send(JSON.stringify({ type: "input", text }));
    return true;
  };
  return { ...s.current, send };
}
