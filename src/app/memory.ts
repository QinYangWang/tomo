/**
 * Long-term memory. Spaces are isolated: "global" belongs to the owner's chats, and each
 * project id is its own space. A project never reads chat memory and chat never reads a
 * project's, so a project starts from zero and its details stay inside it.
 */
import { db, now } from "./db.ts";

export type MemoryKind = "profile" | "preference" | "person" | "place" | "fact" | "decision" | "episode";
export type Memory = {
  id: number;
  kind: MemoryKind;
  subject: string;
  content: string;
  scope: string;
  confidence: "stated" | "inferred";
  source: string | null;
  updated_at: number;
};

export const memory = {
  add(m: { kind: MemoryKind; subject: string; content: string; scope?: string; confidence?: "stated" | "inferred"; source?: string }): number {
    // Same subject + near-identical content: update instead of duplicating.
    const dup = db
      .query("SELECT id FROM memories WHERE archived = 0 AND subject = ? AND content = ? AND scope = ?")
      .get(m.subject, m.content, m.scope ?? "global") as { id: number } | null;
    if (dup) {
      db.run("UPDATE memories SET updated_at = ? WHERE id = ?", [now(), dup.id]);
      return dup.id;
    }
    const r = db.run(
      "INSERT INTO memories(kind, subject, content, scope, confidence, source, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
      [m.kind, m.subject, m.content, m.scope ?? "global", m.confidence ?? "stated", m.source ?? null, now(), now()],
    );
    return Number(r.lastInsertRowid);
  },

  update(id: number, content: string, confidence?: "stated" | "inferred") {
    db.run("UPDATE memories SET content = ?, confidence = COALESCE(?, confidence), updated_at = ? WHERE id = ?", [content, confidence ?? null, now(), id]);
  },

  forget(id: number) {
    db.run("DELETE FROM memories WHERE id = ?", [id]);
  },

  search(query: string, opts: { scope?: string; limit?: number } = {}): Memory[] {
    const limit = opts.limit ?? 12;
    const scopes = [opts.scope ?? "global"];
    const ph = scopes.map(() => "?").join(",");
    const q = query.trim();
    if (q.length >= 3) {
      const fts = q.replace(/"/g, '""');
      try {
        const rows = db
          .query(
            `SELECT m.* FROM memories_fts f JOIN memories m ON m.id = f.rowid
             WHERE memories_fts MATCH ? AND m.archived = 0 AND m.scope IN (${ph})
             ORDER BY bm25(memories_fts), m.updated_at DESC LIMIT ?`,
          )
          .all(`"${fts}"`, ...scopes, limit) as Memory[];
        if (rows.length) return rows;
      } catch {
        /* fall through to LIKE */
      }
    }
    // Short queries (trigram needs 3 chars) and multi-word misses: match any word.
    const words = q.split(/\s+/).filter(Boolean).slice(0, 6);
    if (!words.length) return this.recent({ scope: opts.scope, limit });
    const where = words.map(() => "(subject LIKE ? OR content LIKE ?)").join(" OR ");
    const args = words.flatMap((w) => [`%${w}%`, `%${w}%`]);
    return db
      .query(`SELECT * FROM memories WHERE archived = 0 AND scope IN (${ph}) AND (${where}) ORDER BY updated_at DESC LIMIT ?`)
      .all(...scopes, ...args, limit) as Memory[];
  },

  recent(opts: { scope?: string; limit?: number; kinds?: MemoryKind[] } = {}): Memory[] {
    const scopes = [opts.scope ?? "global"];
    const kinds = opts.kinds ?? ["profile", "preference", "person", "place", "fact", "decision", "episode"];
    return db
      .query(
        `SELECT * FROM memories WHERE archived = 0 AND scope IN (${scopes.map(() => "?").join(",")})
         AND kind IN (${kinds.map(() => "?").join(",")}) ORDER BY updated_at DESC LIMIT ?`,
      )
      .all(...scopes, ...kinds, opts.limit ?? 40) as Memory[];
  },

  /** The always-on core: who the user is and how they like things done. */
  core(scope?: string): Memory[] {
    return this.recent({ scope, kinds: ["profile", "preference"], limit: 40 });
  },
};

export const formatMemories = (rows: Memory[]) =>
  rows.map((m) => `#${m.id} [${m.kind}${m.confidence === "inferred" ? ", inferred" : ""}] ${m.subject}: ${m.content}`).join("\n");
