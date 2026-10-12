// A conversation: transcript + composer, on beUI's agent parts. Used by the chat view and by each project.
import { Link } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { AgentActivity } from "@/components/agents/agent-activity";
import type { AgentCodeLanguage } from "@/components/agents/agent-code";
import { CodeBlock } from "@/components/agents/code-block";
import { ThinkingShimmer } from "@/components/agents/loading-states/thinking-shimmer";
import { Message, MessageContent } from "@/components/agents/message";
import { MessageBubble, MessageBubbleContent } from "@/components/agents/message-bubble";
import { MessageScroller } from "@/components/agents/message-scroller";
import { PromptInput } from "@/components/agents/prompt-input";
import { Icon } from "../icons.tsx";
import { md } from "../lib.ts";
import { PROSE } from "./ui.tsx";
import { useSettings } from "../queries.ts";
import { useStream, type Item } from "./stream.ts";

function Work({ item }: { item: Extract<Item, { k: "work" }> }) {
  const items = useMemo(
    () => item.steps.map((s, i) => ({ id: String(i), type: "step" as const, label: s, status: item.done || i < item.steps.length - 1 ? ("complete" as const) : ("active" as const) })),
    [item.steps.length, item.done],
  );
  return (
    <AgentActivity
      className={`work ${item.done ? "done" : ""}`} items={items} status={item.done ? "complete" : "working"} collapseOnComplete
      activeLabel={`正在${item.steps.at(-1) ? `：${item.steps.at(-1)}` : "处理"}`} summary={`做了 ${item.steps.length} 步`} maxHeight={220}
    />
  );
}

const LANGS: Record<string, AgentCodeLanguage> = { ts: "typescript", typescript: "typescript", js: "typescript", javascript: "typescript", tsx: "tsx", jsx: "tsx", sh: "bash", shell: "bash", bash: "bash", zsh: "bash", console: "bash", json: "json", diff: "diff" };
const lang = (l: string): AgentCodeLanguage => LANGS[l.toLowerCase()] ?? "text";

/** Assistant text: prose through the markdown renderer, fenced code through beUI's code block. */
function AiText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /```(\w*)\n?([\s\S]*?)```/g;
  let at = 0;
  for (let m; (m = re.exec(text)); at = re.lastIndex) {
    if (m.index > at) parts.push(<div key={at} className={PROSE} dangerouslySetInnerHTML={{ __html: md(text.slice(at, m.index)) }} />);
    parts.push(<CodeBlock key={m.index} code={m[2]!.replace(/\n$/, "")} language={lang(m[1]!)} copyable className="my-2 w-full" />);
  }
  if (at < text.length) parts.push(<div key={at} className={PROSE} dangerouslySetInnerHTML={{ __html: md(text.slice(at)) }} />);
  return <>{parts}</>;
}

export function ChatPane({ conv, placeholder, empty, onSent }: { conv?: string; placeholder: string; empty: ReactNode; onSent?: () => void }) {
  const { items, typing, loaded, send } = useStream(conv);
  const model = useSettings().data?.model.modelId.split("/").pop();
  const [text, setText] = useState("");
  const submit = (v: string) => {
    if (!v.trim() || !send(v.trim())) return;
    setText("");
    onSent?.();
  };
  return (
    <div id="chatPane" className="flex min-h-0 flex-1 flex-col">
      <MessageScroller id="thread" followOutput busy={typing} label="对话" className="min-h-0 flex-1" contentClassName="threadInner mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pt-6 pb-8 desk:px-7" contentProps={{ id: "log" } as object}>
        {loaded && !items.length && !typing && empty}
        {items.map((it, i) =>
          it.k === "work" ? (
            <Work key={i} item={it} />
          ) : it.k === "ai" ? (
            <Message key={i} from="assistant">
              <MessageContent><div className="b ai w-full" data-entry={it.id}><AiText text={it.text} /></div></MessageContent>
            </Message>
          ) : (
            <Message key={i} from="user" animateIn={i === items.length - 1}>
              <MessageContent><MessageBubble variant="soft" align="end" className="b me" data-entry={it.id}><MessageBubbleContent className="whitespace-pre-wrap text-[15px]">{it.text}</MessageBubbleContent></MessageBubble></MessageContent>
            </Message>
          ),
        )}
        {typing && <div className="typing self-start px-0.5 text-sm"><ThinkingShimmer>正在想…</ThinkingShimmer></div>}
      </MessageScroller>
      <div id="composer" className="mx-auto w-full max-w-3xl px-3 pb-[max(12px,env(safe-area-inset-bottom))] desk:px-7 desk:pb-5">
        <PromptInput
          id="t" value={text} onValueChange={setText} onSubmit={submit} placeholder={placeholder} aria-label={placeholder} minRows={1} maxRows={8}
          className="composerBox bg-card shadow-[0_8px_30px_-12px_rgb(0_0_0/0.12)] [&_textarea]:text-[15px] max-desk:[&_textarea]:text-base"
          leadingAction={model && <Link className="cChip inline-flex max-w-[60%] items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground" to="/settings/$page" params={{ page: "models" }}><Icon name="ai" size={14} /><span className="truncate">{model}</span></Link>}
        />
      </div>
    </div>
  );
}
