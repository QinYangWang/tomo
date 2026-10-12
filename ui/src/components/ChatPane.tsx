// A conversation: transcript + composer. Used by the chat view and by each project.
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Icon } from "../icons.tsx";
import { useSettings } from "../queries.ts";
import { md } from "../lib.ts";
import { useStream, type Item } from "./stream.ts";

function Work({ item }: { item: Extract<Item, { k: "work" }> }) {
  const last = item.steps.at(-1);
  return (
    <details className={`work ${item.done ? "done" : ""}`}>
      <summary>
        <span className="spin"><Icon name={item.done ? "check" : "loading"} size={16} /></span>
        <span className="label">{item.done ? `用了 ${item.steps.length} 个步骤` : `正在处理${last ? ` · ${last}` : ""}`}</span>
      </summary>
      <ol>{item.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
    </details>
  );
}

export function ChatPane({ conv, placeholder, empty, onSent }: { conv?: string; placeholder: string; empty: ReactNode; onSent?: () => void }) {
  const { items, typing, loaded, send } = useStream(conv);
  const model = useSettings().data?.model.modelId.split("/").pop();
  const [text, setText] = useState("");
  const thread = useRef<HTMLDivElement>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const last = items.at(-1);
  const tail = `${items.length}:${last && "text" in last ? last.text.length : last?.steps.length}:${typing}`;
  useLayoutEffect(() => {
    if (thread.current) thread.current.scrollTop = 1e9;
  }, [tail]);
  useLayoutEffect(() => {
    const t = ta.current;
    if (!t) return;
    t.style.height = "";
    t.style.height = Math.min(t.scrollHeight, 200) + "px";
  }, [text]);
  const submit = () => {
    const v = text.trim();
    if (!v || !send(v)) return;
    setText("");
    onSent?.();
  };
  return (
    <div id="chatPane">
      <div id="thread" ref={thread}>
        <div className="threadInner" id="log">
          {loaded && !items.length && !typing && empty}
          {items.map((it, i) =>
            it.k === "work" ? <Work key={i} item={it} /> : it.k === "ai" ? (
              <div key={i} className="b ai" data-entry={it.id} dangerouslySetInnerHTML={{ __html: md(it.text) }} />
            ) : (
              <div key={i} className="b me" data-entry={it.id}>{it.text}</div>
            ),
          )}
          {typing && <div className="typing"><i /><i /><i /></div>}
        </div>
      </div>
      <form id="composer" onSubmit={(e) => (e.preventDefault(), submit())} onClick={(e) => e.target === e.currentTarget && ta.current?.focus()}>
        <textarea
          id="t" ref={ta} rows={1} placeholder={placeholder} value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && matchMedia("(pointer:fine)").matches) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <div className="cTools">
          {model && <Link className="cChip" to="/settings/$page" params={{ page: "models" }}><Icon name="ai" size={14} /><span className="ell">{model}</span></Link>}
          <span className="grow" />
          <button className="send" aria-label="发送" disabled={!text.trim()}><Icon name="send" size={18} /></button>
        </div>
      </form>
    </div>
  );
}
