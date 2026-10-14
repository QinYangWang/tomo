// One conversation's live transcript over the WebSocket: a snapshot first, then Pi Durable agent events.
import { useEffect, useReducer, useRef } from "react";
import { session } from "../api.ts";
import { toast } from "../store.tsx";

export type Step = { id: string; name: string; args: any; status: "active" | "done" | "error"; output?: string };
export type Work = { k: "work"; steps: Step[]; thinking: string; done: boolean; started: number; ended?: number };
export type Item =
  | { k: "me"; text: string; id?: string }
  | { k: "ai"; text: string; id?: string; live?: boolean }
  | { k: "error"; text: string; stopped?: boolean }
  | Work;
export type ModelRef = { provider: string; modelId: string };
export type AgentState = { model?: ModelRef; thinkingLevel?: string };
type State = { items: Item[]; busy: boolean; loaded: boolean; agent: AgentState; live: number | null; work: number | null; lastUser: string };

const blocks = (msgs: any[]) => (msgs ?? []).flatMap((m) => (typeof m.content === "string" ? [{ type: "text", text: m.content }] : (m.content ?? [])));
const textOf = (msgs: any[]) => blocks(msgs).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
const resultText = (msgs: any[]) => textOf(msgs).slice(0, 2000);

export function useStream(conv: string | undefined) {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const s = useRef<State>({ items: [], busy: false, loaded: false, agent: {}, live: null, work: null, lastUser: "" });
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!conv) return;
    let disposed = false;
    const st = s.current;
    const reset = (loaded: boolean) => Object.assign(st, { items: [], busy: false, loaded, live: null, work: null });
    reset(false);
    bump();

    const work = (at = Date.now()): Work => {
      if (st.work === null) st.work = st.items.push({ k: "work", steps: [], thinking: "", done: false, started: at }) - 1;
      return st.items[st.work] as Work;
    };
    const finishWork = (at = Date.now()) => {
      if (st.work === null) return;
      const w = st.items[st.work] as Work;
      Object.assign(w, { done: true, ended: w.ended ?? at });
      for (const x of w.steps) if (x.status === "active") x.status = "done";
      // Nothing worth showing (no tools, no thinking): drop the empty block.
      if (!w.steps.length && !w.thinking.trim()) st.items.splice(st.work, 1);
      st.work = null;
    };
    const stepFor = (id: string) => {
      for (let i = st.items.length - 1; i >= 0; i--) {
        const it = st.items[i]!;
        if (it.k === "work") {
          const hit = it.steps.find((x) => x.id === id);
          if (hit) return hit;
        }
      }
    };
    const addStep = (c: any, t0?: number) => stepFor(c.id) || work(t0).steps.push({ id: c.id, name: c.name, args: c.arguments, status: "active" });
    const push = (it: Item) => st.items.push(it) - 1;
    const failure = (m: any) => {
      if (m?.stopReason === "aborted") push({ k: "error", text: "已停止", stopped: true });
      else if (m?.stopReason === "error") push({ k: "error", text: String(m.errorMessage || "模型出错了") });
    };
    const at = (e: any) => (e.model?.[0] as any)?.timestamp ?? Date.now();

    // A committed entry, from the snapshot or the live stream.
    const entry = (e: any) => {
      if (e.kind === "pi.user") {
        finishWork();
        st.lastUser = textOf(e.model);
        push({ k: "me", text: st.lastUser, id: String(e.id) });
      } else if (e.kind === "pi.assistant") {
        const t0 = at(e);
        for (const c of blocks(e.model)) {
          if (c.type === "thinking" && c.thinking?.trim()) work(t0).thinking += (work(t0).thinking ? "\n\n" : "") + c.thinking;
          if (c.type === "toolCall") addStep(c, t0);
        }
        const t = textOf(e.model);
        if (t) {
          finishWork(t0);
          push({ k: "ai", text: t, id: String(e.id) });
        }
        failure(e.model?.[0]);
      } else if (e.kind === "pi.tool") {
        const m = e.model?.[0];
        const x = m && stepFor(m.toolCallId);
        if (x) Object.assign(x, { status: m.isError ? "error" : "done", output: resultText(e.model) });
        if (st.work !== null) (st.items[st.work] as Work).ended = at(e);
      }
    };

    const open = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const sock = (ws.current = new WebSocket(`${proto}://${location.host}/ws?conversation=${encodeURIComponent(conv)}&token=${encodeURIComponent(session.token)}`));
      sock.onmessage = (ev) => {
        for (const e of JSON.parse(ev.data)) {
          switch (e.type) {
            case "snapshot":
              reset(true);
              st.agent = e.agent ?? {};
              e.entries.forEach(entry);
              if (e.run) {
                st.busy = true;
                const partial = e.generation?.message;
                if (partial) for (const c of partial.content ?? []) if (c.type === "thinking") work().thinking += c.thinking ?? "";
              } else finishWork();
              break;
            case "agent_changed":
              st.agent = e.agent ?? {};
              break;
            case "run_start":
              st.busy = true;
              break;
            case "message_start":
              if (e.message?.role === "assistant") st.live = null;
              break;
            case "message_update":
              for (const c of e.changes ?? []) {
                if (c.type === "thinking_delta") work().thinking += c.delta;
                else if (c.type === "text_delta") {
                  if (st.live === null) {
                    finishWork();
                    st.live = push({ k: "ai", text: "", live: true });
                  }
                  (st.items[st.live] as { text: string }).text += c.delta;
                }
              }
              break;
            case "message_end":
              if (e.entry?.kind === "pi.user") entry(e.entry);
              else if (e.entry?.kind === "pi.assistant") {
                if (st.live !== null) {
                  // The streamed bubble becomes the committed one; tool calls after the text open a new block.
                  Object.assign(st.items[st.live]!, { text: textOf(e.entry.model), id: String(e.entry.id), live: false });
                  for (const c of blocks(e.entry.model)) if (c.type === "toolCall") addStep(c);
                  failure(e.entry.model?.[0]);
                } else {
                  // No text streamed: drop thinking already shown live, then take the entry whole.
                  if (st.work !== null) (st.items[st.work] as Work).thinking = "";
                  entry(e.entry);
                }
              }
              st.live = null;
              break;
            case "tool_execution_start": {
              const x = stepFor(e.toolCallId);
              if (!x) work().steps.push({ id: e.toolCallId, name: e.toolName, args: e.args, status: "active" });
              break;
            }
            case "tool_execution_update": {
              const x = stepFor(e.toolCallId);
              if (x && e.output) x.output = ("set" in e.output ? e.output.set : (x.output ?? "").slice(e.output.trimStart ?? 0) + (e.output.append ?? "")).slice(-2000);
              break;
            }
            case "tool_execution_end": {
              if (e.entry) entry(e.entry);
              else {
                const x = stepFor(e.toolCallId);
                if (x) x.status = "error";
              }
              break;
            }
            case "auto_retry_start":
              toast("模型出了点问题，正在重试");
              break;
            case "task_failed":
              push({ k: "error", text: String(e.message || "出错了") });
              break;
            case "run_end":
              st.busy = false;
              finishWork();
              break;
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

  const raw = (msg: object) => {
    if (ws.current?.readyState !== 1) return false;
    ws.current.send(JSON.stringify(msg));
    return true;
  };
  return {
    ...s.current,
    send: (text: string) => raw({ type: "input", text }),
    stop: () => raw({ type: "abort" }),
    configure: (change: { model?: ModelRef; thinkingLevel?: string }) => raw({ type: "configure", ...change }),
  };
}
