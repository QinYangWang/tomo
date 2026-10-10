import { Cron } from "croner";
import { config } from "../config.ts";
import { db, now } from "./db.ts";

export type ScheduleKind = "once" | "interval" | "daily" | "cron";
export type Schedule = {
  id: string;
  conversation_id: string;
  title: string;
  prompt: string;
  kind: ScheduleKind;
  spec: string;
  next_run: number | null;
  last_run: number | null;
  status: string;
};

/** Next fire time strictly after `after`, or null when the schedule is done. */
export function nextRun(kind: ScheduleKind, spec: string, after: number, isFirst: boolean): number | null {
  switch (kind) {
    case "once": {
      if (!isFirst) return null;
      const t = Date.parse(spec);
      if (Number.isNaN(t)) throw new Error(`Bad ISO time: ${spec}`);
      return t;
    }
    case "interval": {
      const s = Number(spec);
      if (!(s >= 60)) throw new Error("Interval must be at least 60 seconds");
      return after + s * 1000;
    }
    case "daily": {
      const m = spec.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) throw new Error(`Daily spec must be HH:MM, got ${spec}`);
      return new Cron(`${Number(m[2])} ${Number(m[1])} * * *`, { timezone: config.timezone }).nextRun(new Date(after))?.getTime() ?? null;
    }
    case "cron":
      return new Cron(spec, { timezone: config.timezone }).nextRun(new Date(after))?.getTime() ?? null;
  }
}

export const schedules = {
  create(s: { conversationId: string; title: string; prompt: string; kind: ScheduleKind; spec: string }): Schedule {
    const id = `s_${now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const next = nextRun(s.kind, s.spec, now(), true);
    db.run(
      "INSERT INTO schedules(id, conversation_id, title, prompt, kind, spec, next_run, created_at) VALUES (?,?,?,?,?,?,?,?)",
      [id, s.conversationId, s.title, s.prompt, s.kind, s.spec, next, now()],
    );
    return this.get(id)!;
  },
  get(id: string): Schedule | undefined {
    return (db.query("SELECT * FROM schedules WHERE id = ?").get(id) as Schedule | null) ?? undefined;
  },
  list(conversationId?: string): Schedule[] {
    return (
      conversationId
        ? db.query("SELECT * FROM schedules WHERE status = 'active' AND conversation_id = ? ORDER BY next_run").all(conversationId)
        : db.query("SELECT * FROM schedules WHERE status = 'active' ORDER BY next_run").all()
    ) as Schedule[];
  },
  due(at = now()): Schedule[] {
    return db.query("SELECT * FROM schedules WHERE status = 'active' AND next_run IS NOT NULL AND next_run <= ?").all(at) as Schedule[];
  },
  /** Advance past `firedAt` before running, so a crash mid-run never fires twice (the requestId dedupes too). */
  advance(s: Schedule, firedAt: number) {
    const next = nextRun(s.kind, s.spec, Math.max(firedAt, now()), false);
    db.run("UPDATE schedules SET last_run = ?, next_run = ?, status = ? WHERE id = ?", [firedAt, next, next === null ? "done" : "active", s.id]);
  },
  cancel(id: string) {
    db.run("UPDATE schedules SET status = 'cancelled' WHERE id = ?", [id]);
  },
};
