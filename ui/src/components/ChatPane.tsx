// A conversation: transcript + composer, on beUI's agent parts. Used by the chat view and by each project.
import { Check, ChevronDown, ChevronRight, CircleAlert, Copy, LoaderCircle, RotateCcw, Search } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AgentDisclosure } from "@/components/agents/agent-disclosure";
import type { AgentCodeLanguage } from "@/components/agents/agent-code";
import { CodeBlock } from "@/components/agents/code-block";
import { ThinkingShimmer } from "@/components/agents/loading-states/thinking-shimmer";
import { Message, MessageContent } from "@/components/agents/message";
import { MessageBubble, MessageBubbleContent } from "@/components/agents/message-bubble";
import { MessageScroller } from "@/components/agents/message-scroller";
import { PromptInput } from "@/components/agents/prompt-input";
import { MorphPopover, MorphPopoverContent, MorphPopoverTrigger } from "@/components/motion/popover-morph";
import { cn } from "@/lib/utils";
import { Icon } from "../icons.tsx";
import { md, toolLabel } from "../lib.ts";
import { useAllModels, useSettings } from "../queries.ts";
import { toast } from "../store.tsx";
import { PROSE } from "./ui.tsx";
import { useStream, type AgentState, type Item, type ModelRef, type Step, type Work } from "./stream.ts";

const secs = (ms: number) => {
  const s = Math.max(1, Math.round(ms / 1000));
  return s < 60 ? `${s} 秒` : `${Math.floor(s / 60)} 分 ${s % 60} 秒`;
};

/** Ticks once a second while a run is going, for the elapsed time. */
function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function StepRow({ step }: { step: Step }) {
  const [open, setOpen] = useState(false);
  const [name, hint] = toolLabel(step.name, step.args).split(" · ");
  const canOpen = !!step.output?.trim();
  return (
    <li className="step">
      <button
        type="button" disabled={!canOpen} onClick={() => setOpen(!open)} aria-expanded={canOpen ? open : undefined}
        className="grid w-full grid-cols-[1rem_auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-md px-1.5 py-1 text-left text-[13px] transition-colors enabled:hover:bg-muted/70"
      >
        <span className="grid size-4 place-items-center">
          {step.status === "active" ? <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" /> : step.status === "error" ? <CircleAlert className="size-3.5 text-destructive" /> : <Check className="size-3.5 text-muted-foreground/70" />}
        </span>
        <span className={cn("font-medium", step.status === "error" ? "text-destructive" : "text-foreground/85")}>{name}</span>
        <span className="min-w-0 truncate font-mono text-xs text-muted-foreground/75">{hint ?? ""}</span>
        {canOpen ? <ChevronRight className={cn("size-3.5 text-muted-foreground/60 transition-transform", open && "rotate-90")} /> : <span />}
      </button>
      {canOpen && (
        <AgentDisclosure open={open}>
          <pre className="ml-8 mt-1 mb-1.5 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/70 px-3 py-2 font-mono text-xs leading-5 text-muted-foreground">{step.output}</pre>
        </AgentDisclosure>
      )}
    </li>
  );
}

/** What the agent did between messages: its thinking and its tool calls, open while it works. */
function WorkBlock({ item }: { item: Work }) {
  const now = useNow(!item.done);
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? !item.done;
  const current = item.steps.findLast((x) => x.status === "active");
  const errors = item.steps.filter((x) => x.status === "error").length;
  const took = (item.ended ?? now) - item.started;
  const parts = [item.thinking.trim() && "思考", item.steps.length && `${item.steps.length} 个步骤`, errors && `${errors} 个出错`].filter(Boolean).join("，");
  return (
    <div className={cn("work w-full text-sm", item.done && "done")}>
      <button type="button" onClick={() => setUserOpen(!open)} aria-expanded={open} className="flex max-w-full items-center gap-1.5 rounded-md py-1 text-left text-muted-foreground transition-colors hover:text-foreground">
        {item.done ? (
          <span className="truncate">{parts || "处理"} · {secs(took)}</span>
        ) : (
          <ThinkingShimmer>{current ? `正在${toolLabel(current.name, current.args).split(" · ")[0]}…` : item.thinking ? "正在思考…" : "正在处理…"}</ThinkingShimmer>
        )}
        {!item.done && took > 2000 && <span className="text-xs tabular-nums text-muted-foreground/60">{secs(took)}</span>}
        <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", !open && "-rotate-90")} />
      </button>
      <AgentDisclosure open={open}>
        <div className="mt-1 ml-[3px] border-l border-border pl-3">
          {item.thinking.trim() && <p className="thinking mb-1.5 max-h-48 overflow-auto whitespace-pre-wrap py-1 text-[13px] leading-5 text-muted-foreground">{item.thinking.trim()}</p>}
          {!!item.steps.length && <ul className="flex flex-col">{item.steps.map((x) => <StepRow key={x.id} step={x} />)}</ul>}
        </div>
      </AgentDisclosure>
    </div>
  );
}

const LANGS: Record<string, AgentCodeLanguage> = { ts: "typescript", typescript: "typescript", js: "typescript", javascript: "typescript", tsx: "tsx", jsx: "tsx", sh: "bash", shell: "bash", bash: "bash", zsh: "bash", console: "bash", json: "json", diff: "diff" };
const lang = (l: string): AgentCodeLanguage => LANGS[l.toLowerCase()] ?? "text";

/** Assistant text: prose through the markdown renderer, fenced code through beUI's code block. */
function AiText({ text, live }: { text: string; live?: boolean }) {
  const parts: ReactNode[] = [];
  // While streaming, an unclosed fence still renders as code.
  const src = live && (text.match(/```/g)?.length ?? 0) % 2 ? `${text}\n\`\`\`` : text;
  const re = /```(\w*)\n?([\s\S]*?)```/g;
  let at = 0;
  for (let m; (m = re.exec(src)); at = re.lastIndex) {
    if (m.index > at) parts.push(<div key={at} className={PROSE} dangerouslySetInnerHTML={{ __html: md(src.slice(at, m.index)) }} />);
    parts.push(<CodeBlock key={m.index} code={m[2]!.replace(/\n$/, "")} language={lang(m[1]!)} copyable className="my-2 w-full" />);
  }
  if (at < src.length) parts.push(<div key={at} className={PROSE} dangerouslySetInnerHTML={{ __html: md(src.slice(at)) }} />);
  return <>{parts}</>;
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button" aria-label="复制" title="复制"
      onClick={() => navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }, () => toast("复制失败"))}
      className="copyBtn grid size-7 place-items-center rounded-md text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
    >
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}

const LEVELS = [{ v: "off", l: "关" }, { v: "low", l: "低" }, { v: "medium", l: "中" }, { v: "high", l: "高" }];

/** The composer's model chip: this conversation's model and how hard it thinks. */
function ModelPicker({ agent, busy, onChange }: { agent: AgentState; busy: boolean; onChange: (c: { model?: ModelRef; thinkingLevel?: string }) => void }) {
  const fallback = useSettings().data?.model;
  const { data: groups = [] } = useAllModels();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const cur = agent.model ?? fallback;
  const info = groups.find((g) => g.provider === cur?.provider)?.models.find((m) => m.id === cur?.modelId);
  const label = info?.name ?? cur?.modelId.split("/").pop() ?? "选择模型";
  const level = agent.thinkingLevel ?? "off";
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    const isCur = (g: string, m: string) => g === cur?.provider && m === cur?.modelId;
    // The current model leads the list, so it is visible without scrolling or searching.
    return groups
      .map((g) => ({ ...g, models: n ? g.models.filter((m) => `${m.id} ${m.name} ${g.label}`.toLowerCase().includes(n)) : [...g.models].sort((a, b) => +isCur(g.provider, b.id) - +isCur(g.provider, a.id)) }))
      .filter((g) => g.models.length)
      .sort((a, b) => +(b.provider === cur?.provider) - +(a.provider === cur?.provider));
  }, [groups, q, cur?.provider, cur?.modelId]);
  return (
    <MorphPopover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
      <MorphPopoverTrigger>
        <button type="button" disabled={busy} aria-label="选择模型" className="cChip inline-flex max-w-[60vw] items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground disabled:opacity-60 desk:max-w-64">
          <Icon name="ai" size={14} />
          <span className="truncate">{label}</span>
          {info?.reasoning && level !== "off" && <span className="rounded bg-muted px-1 text-[10px]">思考{LEVELS.find((x) => x.v === level)?.l ?? ""}</span>}
          <ChevronDown className="size-3 shrink-0" />
        </button>
      </MorphPopoverTrigger>
      <MorphPopoverContent side="top" align="start" sideOffset={8} radius={14} className="modelMenu w-[min(20rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="size-3.5 text-muted-foreground" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索模型" aria-label="搜索模型" className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground/60" />
        </div>
        <div className="max-h-72 overflow-y-auto p-1.5">
          {!groups.length && <p className="px-2.5 py-3 text-sm text-muted-foreground">还没有可用的模型，先去设置里填一个密钥。</p>}
          {groups.length > 0 && !shown.length && <p className="px-2.5 py-3 text-sm text-muted-foreground">没有找到</p>}
          {shown.map((g) => (
            <div key={g.provider} className="mb-1 last:mb-0">
              {groups.length > 1 && <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-muted-foreground/70">{g.label}</div>}
              {g.models.slice(0, q ? 80 : 40).map((m) => {
                const on = cur?.provider === g.provider && cur?.modelId === m.id;
                return (
                  <button
                    key={m.id} type="button" data-model={`${g.provider}/${m.id}`}
                    onClick={() => { if (!on) onChange({ model: { provider: g.provider, modelId: m.id } }); setOpen(false); setQ(""); }}
                    className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted", on && "bg-muted/60")}
                  >
                    <span className="min-w-0 flex-1 truncate">{m.name}</span>
                    {m.reasoning && <span className="text-[10px] text-muted-foreground/70">可思考</span>}
                    {on && <Check className="size-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        {info?.reasoning && (
          <div className="flex items-center gap-2 border-t border-border px-3 py-2">
            <span className="text-xs text-muted-foreground">思考</span>
            <div role="radiogroup" aria-label="思考强度" className="ml-auto flex rounded-lg bg-muted p-0.5">
              {LEVELS.map((x) => (
                <button
                  key={x.v} type="button" role="radio" aria-checked={level === x.v} onClick={() => onChange({ thinkingLevel: x.v })}
                  className={cn("rounded-md px-2.5 py-0.5 text-xs transition-colors", level === x.v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >{x.l}</button>
              ))}
            </div>
          </div>
        )}
      </MorphPopoverContent>
    </MorphPopover>
  );
}

function Row({ it, i, last, retry }: { it: Item; i: number; last: boolean; retry: () => void }) {
  if (it.k === "work") return <WorkBlock item={it} />;
  if (it.k === "error")
    return (
      <div className={cn("runError flex items-center gap-2 self-start rounded-lg px-3 py-2 text-sm", it.stopped ? "bg-muted text-muted-foreground" : "bg-destructive/10 text-destructive")}>
        {!it.stopped && <CircleAlert className="size-4 shrink-0" />}
        <span className="min-w-0 break-words">{it.text}</span>
        {last && (
          <button type="button" onClick={retry} className="retryBtn ml-1 inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium hover:bg-foreground/[0.06]">
            <RotateCcw className="size-3" />重试
          </button>
        )}
      </div>
    );
  if (it.k === "ai")
    return (
      <Message from="assistant" className="group">
        <MessageContent>
          <div className="b ai w-full" data-entry={it.id}><AiText text={it.text} live={it.live} /></div>
          {!it.live && it.text && <div className="-ml-1.5 mt-0.5 flex opacity-100 transition-opacity desk:opacity-0 desk:group-hover:opacity-100 desk:focus-within:opacity-100"><CopyBtn text={it.text} /></div>}
        </MessageContent>
      </Message>
    );
  return (
    <Message from="user" animateIn={last}>
      <MessageContent><MessageBubble variant="soft" align="end" className="b me" data-entry={it.id}><MessageBubbleContent className="whitespace-pre-wrap text-[15px]">{it.text}</MessageBubbleContent></MessageBubble></MessageContent>
    </Message>
  );
}

export function ChatPane({ conv, placeholder, empty, onSent }: { conv?: string; placeholder: string; empty: ReactNode; onSent?: () => void }) {
  const { items, busy, loaded, agent, lastUser, send, stop, configure } = useStream(conv);
  const [text, setText] = useState("");
  const submit = (v: string) => {
    if (!v.trim() || !send(v.trim())) return;
    setText("");
    onSent?.();
  };
  // The thinking indicator shows only until the run has something of its own on screen.
  const tail = items.at(-1);
  const waiting = busy && (!tail || tail.k === "me" || tail.k === "error");
  return (
    <div id="chatPane" data-busy={busy} className="flex min-h-0 flex-1 flex-col">
      <MessageScroller id="thread" followOutput busy={busy} label="对话" className="min-h-0 flex-1" contentClassName="threadInner mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pt-6 pb-8 desk:px-7" contentProps={{ id: "log" } as object}>
        {loaded && !items.length && !busy && empty}
        {items.map((it, i) => <Row key={i} it={it} i={i} last={i === items.length - 1 && !busy} retry={() => lastUser && send(lastUser)} />)}
        {waiting && <div className="typing self-start px-0.5 text-sm"><ThinkingShimmer>正在想…</ThinkingShimmer></div>}
      </MessageScroller>
      <div id="composer" className="mx-auto w-full max-w-3xl px-3 pb-[max(12px,env(safe-area-inset-bottom))] desk:px-7 desk:pb-5">
        <PromptInput
          id="t" value={text} onValueChange={setText} onSubmit={submit} placeholder={placeholder} aria-label={placeholder} minRows={1} maxRows={8}
          loading={busy} onStop={stop}
          className="composerBox bg-card shadow-[0_8px_30px_-12px_rgb(0_0_0/0.12)] [&_textarea]:text-[15px] max-desk:[&_textarea]:text-base"
          leadingAction={loaded && <ModelPicker agent={agent} busy={busy} onChange={configure} />}
        />
      </div>
    </div>
  );
}
