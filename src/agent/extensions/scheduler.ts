import { Type } from "@earendil-works/pi-ai";
import { defineExtension, defineTool } from "@earendil-works/pi-durable";
import { schedules } from "../../app/schedules.ts";
import { config } from "../../config.ts";
import { text } from "../util.ts";

const fmt = (t: number | null) =>
  t === null ? "never" : new Date(t).toLocaleString("en-CA", { timeZone: config.timezone, hour12: false });

const create = defineTool({
  name: "schedule_create",
  description: `Schedule work for later: a reminder, a recurring check, a daily briefing. When it fires, you receive \`prompt\` in this conversation and your answer is delivered to the user on the surface they last used. Times are in ${config.timezone}.
kind/spec: once + ISO time with offset ("2026-10-11T09:00:00+08:00") | interval + seconds (>= 60) | daily + "HH:MM" | cron + 5-field expression.
Only promise a follow-up you actually scheduled.`,
  parameters: Type.Object({
    title: Type.String(),
    prompt: Type.String({ description: "Self-contained instruction for your future self, with all needed context." }),
    kind: Type.Union([Type.Literal("once"), Type.Literal("interval"), Type.Literal("daily"), Type.Literal("cron")]),
    spec: Type.String(),
  }),
  execute: async (args, api) => {
    try {
      const s = schedules.create({ conversationId: String(api.conversationId), ...args });
      return text(`Scheduled "${s.title}" (${s.id}); first run ${fmt(s.next_run)}.`);
    } catch (e) {
      return text(String(e), true);
    }
  },
});

const list = defineTool({
  name: "schedule_list",
  description: "List active schedules (all conversations when all=true).",
  parameters: Type.Object({ all: Type.Optional(Type.Boolean()) }),
  replay: "safe",
  execute: async (args, api) => {
    const rows = schedules.list(args.all ? undefined : String(api.conversationId));
    return text(rows.length ? rows.map((s) => `- ${s.id} "${s.title}" ${s.kind} ${s.spec}, next ${fmt(s.next_run)}`).join("\n") : "No active schedules.");
  },
});

const cancel = defineTool({
  name: "schedule_cancel",
  description: "Cancel a schedule by id.",
  parameters: Type.Object({ id: Type.String() }),
  replay: "safe",
  execute: async ({ id }) => {
    schedules.cancel(id);
    return text(`Cancelled ${id}.`);
  },
});

export const Scheduler = defineExtension({ name: "scheduler", tools: [create, list, cancel] });
