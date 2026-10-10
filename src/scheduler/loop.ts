/**
 * Fires due schedules. Each firing submits the schedule's prompt to its conversation with
 * requestId "sched:<id>:<time>", so a crash between submit and bookkeeping never fires twice,
 * and the harness finishes an interrupted run after restart.
 */
import { AssistantEntry } from "@earendil-works/pi-durable";
import { panels } from "../app/panels.ts";
import { schedules } from "../app/schedules.ts";
import { cid, ctx, messageText } from "../agent/util.ts";
import type { Gateway } from "../gateway/gateway.ts";

export function startScheduler(gateway: Gateway, everyMs = 20_000) {
  const tick = async () => {
    for (const p of panels.claimDue()) void gateway.buildPanel(p, "refresh").catch((e) => console.error("[panel]", p.id, e));
    for (const s of schedules.due()) {
      const firedAt = s.next_run!;
      schedules.advance(s, firedAt);
      void (async () => {
        const conv = await gateway.harness.conversation(cid(s.conversation_id), ctx);
        if (!conv) return;
        const content = `[Scheduled task "${s.title}" fired at ${new Date(firedAt).toISOString()}]\n${s.prompt}\n\nYour answer will be sent to the user as a message. If there is nothing worth telling them, reply exactly: SKIP`;
        const sub = await conv.submit({ type: "input", content, requestId: `sched:${s.id}:${firedAt}`, whenBusy: "followUp" }, ctx);
        const settled = await sub.wait(ctx);
        if (settled.status !== "done" || settled.type !== "input" || !settled.answer) return;
        const entry = await conv.commit((tx) => tx.entry(AssistantEntry, settled.answer!), ctx);
        const answer = messageText(entry as any);
        if (answer && answer !== "SKIP") await gateway.deliver(s.conversation_id, answer);
      })().catch((e) => console.error("[scheduler]", s.id, e));
    }
  };
  const timer = setInterval(() => void tick().catch((e) => console.error("[scheduler]", e)), everyMs);
  void tick();
  return () => clearInterval(timer);
}
