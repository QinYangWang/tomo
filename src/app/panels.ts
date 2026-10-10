/**
 * Home panels: glanceable cards the agent builds and keeps fresh.
 *
 * A panel starts from a request in the owner's words ("BTC price", "my week's schedules").
 * The agent gathers what it needs and publishes a short markdown body with the panel_publish
 * tool. A panel with a cadence is re-run on that cadence by the scheduler loop.
 */
import { randomUUID } from "node:crypto";
import { db, now } from "./db.ts";

db.exec(`
  CREATE TABLE IF NOT EXISTS panels (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    request      TEXT NOT NULL,              -- what the owner asked for, verbatim
    body         TEXT NOT NULL DEFAULT '',   -- markdown the card shows
    status       TEXT NOT NULL DEFAULT 'building', -- building | live | error
    error        TEXT,
    cadence      TEXT NOT NULL DEFAULT 'none',     -- none | hourly | daily | weekly
    next_refresh INTEGER,
    position     INTEGER NOT NULL DEFAULT 0,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL
  );
`);

export type Cadence = "none" | "hourly" | "daily" | "weekly";
export type Panel = {
  id: string; title: string; request: string; body: string; status: "building" | "live" | "error";
  error: string | null; cadence: Cadence; next_refresh: number | null; position: number; created_at: number; updated_at: number;
};
const STEP: Record<Cadence, number | null> = { none: null, hourly: 3_600_000, daily: 86_400_000, weekly: 7 * 86_400_000 };
const next = (c: Cadence, from = now()) => (STEP[c] ? from + STEP[c]! : null);

export const panels = {
  list(): Panel[] {
    return db.query("SELECT * FROM panels ORDER BY position, created_at").all() as Panel[];
  },
  get(id: string): Panel | undefined {
    return (db.query("SELECT * FROM panels WHERE id = ?").get(id) as Panel | null) ?? undefined;
  },
  create(request: string): Panel {
    const id = randomUUID().slice(0, 8);
    const pos = ((db.query("SELECT MAX(position) AS m FROM panels").get() as { m: number | null }).m ?? 0) + 1;
    db.run("INSERT INTO panels(id, title, request, position, created_at, updated_at) VALUES (?,?,?,?,?,?)", [id, request.slice(0, 40), request, pos, now(), now()]);
    return this.get(id)!;
  },
  publish(id: string, p: { title?: string; body: string; cadence?: Cadence }) {
    const cur = this.get(id);
    if (!cur) throw new Error(`no panel ${id}`);
    const cadence = p.cadence ?? cur.cadence;
    db.run("UPDATE panels SET title = ?, body = ?, cadence = ?, status = 'live', error = NULL, next_refresh = ?, updated_at = ? WHERE id = ?", [
      p.title ?? cur.title, p.body, cadence, next(cadence), now(), id,
    ]);
    return this.get(id)!;
  },
  setStatus(id: string, status: Panel["status"], error?: string) {
    db.run("UPDATE panels SET status = ?, error = ?, updated_at = ? WHERE id = ?", [status, error ?? null, now(), id]);
  },
  /** Push the next refresh out before running it, so a crash mid-refresh never loops. */
  claimDue(at = now()): Panel[] {
    const due = db.query("SELECT * FROM panels WHERE next_refresh IS NOT NULL AND next_refresh <= ? AND status != 'building'").all(at) as Panel[];
    for (const p of due) db.run("UPDATE panels SET next_refresh = ? WHERE id = ?", [next(p.cadence, at), p.id]);
    return due;
  },
  remove(id: string) {
    db.run("DELETE FROM panels WHERE id = ?", [id]);
  },
};
