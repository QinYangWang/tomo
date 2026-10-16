// A conversation: transcript + composer, on qinyang/ui's agent parts. Used by the chat view and by each project.
import { useMemo, useRef, useState, type ReactNode } from "react";
import { BotIcon, CheckIcon, CopyIcon, RefreshIcon } from "@/components/icons";
import { AgentComposer } from "@/components/agent-composer";
import { Alert, AlertAction, AlertDescription, AlertIcon, AlertContent } from "@/ui/alert";
import { Button } from "@/ui/button";
import { Message, MessageAction, MessageActions, MessageBubble, MessageContent } from "@/ui/message";
import { MessageScroller } from "@/ui/message-scroller";
import { EffortPicker, ModelPicker } from "@/ui/model-picker";
import { ResponseMarkdown } from "@/ui/streaming-response";
import { Terminal, TerminalOutput } from "@/ui/terminal-view";
import { TextShimmer } from "@/ui/text-shimmer";
import { WorkSummary, WorkSummaryStep, WorkSummaryThought, type WorkStepKind } from "@/ui/work-summary";
import { cn } from "@/lib/utils";
import { toolLabel } from "../lib.ts";
import { useAllModels, useSettings } from "../queries.ts";
import { toast } from "../store.tsx";
import { useStream, type AgentState, type Item, type ModelRef, type Step, type Work } from "./stream.ts";

const secs = (ms: number) => {
  const s = Math.max(1, Math.round(ms / 1000));
  return s < 60 ? `${s} 秒` : `${Math.floor(s / 60)} 分 ${s % 60} 秒`;
};

/** Tomo's tools mapped onto the step kinds the work summary draws icons for. */
const KIND: Record<string, WorkStepKind> = {
  bash: "execute", read: "read", write: "edit", edit: "edit", fetch_url: "fetch", search_history: "search", recall: "search",
  forget: "delete", panel_remove: "delete", schedule_cancel: "delete", project_switch: "switch_mode",
};

function StepRow({ step }: { step: Step }) {
  const [name, hint] = toolLabel(step.name, step.args).split(" · ");
  const status = step.status === "active" ? "in_progress" : step.status === "error" ? "failed" : "completed";
  const out = step.output?.trim();
  return (
    <WorkSummaryStep className="step" kind={KIND[step.name] ?? "other"} status={status} title={name} detail={hint} collapsible defaultOpen={step.status === "error"}>
      {out ? <Terminal variant="embedded"><TerminalOutput text={out} className="max-h-60" /></Terminal> : null}
    </WorkSummaryStep>
  );
}

/** What the agent did between messages: its thinking and its tool calls, open while it works. */
function WorkBlock({ item }: { item: Work }) {
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? !item.done;
  const current = item.steps.findLast((x) => x.status === "active");
  const errors = item.steps.filter((x) => x.status === "error").length;
  const took = (item.ended ?? Date.now()) - item.started;
  const parts = [item.thinking.trim() && "思考", item.steps.length && `${item.steps.length} 个步骤`, errors && `${errors} 个出错`].filter(Boolean).join("，");
  const label = item.done ? `${parts || "处理"} · ${secs(took)}` : current ? `正在${toolLabel(current.name, current.args).split(" · ")[0]}…` : item.thinking ? "正在思考…" : "正在处理…";
  return (
    <WorkSummary className={cn("work", item.done && "done")} running={!item.done} startedAt={item.started} label={label} open={open} onOpenChange={setUserOpen}>
      {item.thinking.trim() && <WorkSummaryThought className="thinking" title="思考" defaultOpen={!item.done}>{item.thinking.trim()}</WorkSummaryThought>}
      {item.steps.map((x) => <StepRow key={x.id} step={x} />)}
    </WorkSummary>
  );
}

function CopyAction({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <MessageAction
      className="copyBtn" label={done ? "已复制" : "复制"}
      onClick={() => navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }, () => toast("复制失败"))}
    >
      {done ? <CheckIcon /> : <CopyIcon />}
    </MessageAction>
  );
}

const LEVELS = [{ value: "off", label: "关" }, { value: "low", label: "低" }, { value: "medium", label: "中" }, { value: "high", label: "高" }];
const key = (m?: ModelRef) => (m ? `${m.provider}/${m.modelId}` : "");

/** The composer's pickers: this conversation's model and, for models that reason, how hard it thinks. */
function Pickers({ agent, busy, onChange }: { agent: AgentState; busy: boolean; onChange: (c: { model?: ModelRef; thinkingLevel?: string }) => void }) {
  const fallback = useSettings().data?.model;
  const { data: groups = [] } = useAllModels();
  const cur = agent.model ?? fallback;
  const info = groups.find((g) => g.provider === cur?.provider)?.models.find((m) => m.id === cur?.modelId);
  // The current model leads its group and its group leads the list, so it shows without scrolling.
  const models = useMemo(() => {
    const ordered = [...groups].sort((a, b) => +(b.provider === cur?.provider) - +(a.provider === cur?.provider));
    const list: { id: string; name: string; provider?: string; description?: string }[] = ordered.flatMap((g) =>
      [...g.models]
        .sort((a, b) => +(b.id === cur?.modelId) - +(a.id === cur?.modelId))
        .map((m) => ({ id: `${g.provider}/${m.id}`, name: m.name, provider: groups.length > 1 ? g.label : undefined, description: m.reasoning ? "可思考" : undefined })),
    );
    // A model the lists no longer offer still shows on the chip.
    if (cur && !list.some((m) => m.id === key(cur))) list.unshift({ id: key(cur), name: cur.modelId.split("/").pop()! });
    return list;
  }, [groups, cur?.provider, cur?.modelId]);

  const pick = (v: string) => {
    const i = v.indexOf("/");
    const next = { provider: v.slice(0, i), modelId: v.slice(i + 1) };
    if (key(next) !== key(cur)) onChange({ model: next });
  };
  return (
    <>
      <ModelPicker
        className="cChip" heading={groups.length ? undefined : "还没有可用的模型，先去设置里填一个密钥。"} placeholder="选择模型" icon={<BotIcon />}
        models={models} value={key(cur) || undefined} onValueChange={pick} disabled={busy}
        searchable searchPlaceholder="搜索模型" emptyLabel="没有这个模型" maxPerGroup={8}
      />
      {info?.reasoning && (
        <EffortPicker label="思考" heading="思考" levels={LEVELS} value={agent.thinkingLevel ?? "off"} onValueChange={(v) => onChange({ thinkingLevel: v })} disabled={busy} align="end" />
      )}
    </>
  );
}

function Row({ it, last, retry }: { it: Item; last: boolean; retry: () => void }) {
  if (it.k === "work") return <WorkBlock item={it} />;
  if (it.k === "error")
    return (
      <Alert variant={it.stopped ? "default" : "destructive"} size="sm" className="runError">
        {!it.stopped && <AlertIcon />}
        <AlertContent><AlertDescription>{it.text}</AlertDescription></AlertContent>
        {last && <AlertAction><Button className="retryBtn" variant="ghost" size="xs" onClick={retry}><RefreshIcon data-icon="inline-start" />重试</Button></AlertAction>}
      </Alert>
    );
  if (it.k === "ai")
    return (
      <Message from="assistant" aria-label="Tomo">
        <div className="flex w-full min-w-0 flex-col gap-1">
          <div className="b ai" data-entry={it.id}><ResponseMarkdown text={it.text} caret={!!it.live} /></div>
          {!it.live && it.text && <MessageActions className="-ms-1.5"><CopyAction text={it.text} /></MessageActions>}
        </div>
      </Message>
    );
  return (
    <Message from="user" animateIn={last} aria-label="你">
      <MessageContent><MessageBubble tone="muted" className="b me whitespace-pre-wrap" data-entry={it.id}>{it.text}</MessageBubble></MessageContent>
    </Message>
  );
}

export function ChatPane({ conv, placeholder, empty, onSent }: { conv?: string; placeholder: string; empty: ReactNode; onSent?: () => void }) {
  const { items, busy, loaded, agent, lastUser, send, stop, configure } = useStream(conv);
  const [text, setText] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const submit = (v: string) => {
    // The composer clears itself after submit; put the words back if they could not be sent.
    if (!v.trim() || !send(v.trim())) return void setTimeout(() => setText(v), 0);
    onSent?.();
  };
  // The thinking indicator shows only until the run has something of its own on screen.
  const tail = items.at(-1);
  const waiting = busy && (!tail || tail.k === "me" || tail.k === "error");
  return (
    <div id="chatPane" data-busy={busy} className="flex min-h-0 flex-1 flex-col">
      <MessageScroller id="thread" className="min-h-0 flex-1" jumpButton="icon" contentClassName="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pt-6 pb-8 md:px-7">
        <div id="log" className="flex flex-col gap-5">
          {loaded && !items.length && !busy && empty}
          {items.map((it, i) => <Row key={i} it={it} last={i === items.length - 1 && !busy} retry={() => lastUser && send(lastUser)} />)}
          {waiting && <div className="typing self-start text-ui"><TextShimmer>正在想…</TextShimmer></div>}
        </div>
      </MessageScroller>
      <div id="composer" className="mx-auto w-full max-w-3xl shrink-0 px-3 pb-3 md:px-7 md:pb-5">
        <AgentComposer
          ref={input} value={text} onValueChange={setText} onSubmit={submit} placeholder={placeholder}
          inputProps={{ id: "msgInput", name: "message", enterKeyHint: "send" }}
          busy={busy} onStop={stop}
          toolbarEnd={loaded ? <Pickers agent={agent} busy={busy} onChange={configure} /> : undefined}
        />
      </div>
    </div>
  );
}
