import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "../config.ts";
import { db, now } from "./db.ts";

/**
 * A project is its own thread: one fresh conversation, its own memory space, its own working
 * directory and brief. The owner's chats only see the project list (name and status).
 */
try {
  db.exec("ALTER TABLE projects ADD COLUMN conversation_id TEXT");
} catch {
  /* already there */
}

export type Project = { id: string; name: string; brief: string; status: string; updated_at: number; conversation_id: string | null };

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || `p-${Date.now().toString(36)}`;

export const projects = {
  dir(id: string) {
    const d = join(config.projectsDir, id);
    mkdirSync(d, { recursive: true });
    return d;
  },
  list(includeArchived = false): Project[] {
    return db
      .query(`SELECT * FROM projects ${includeArchived ? "" : "WHERE status = 'active'"} ORDER BY updated_at DESC`)
      .all() as Project[];
  },
  get(id: string): Project | undefined {
    return (db.query("SELECT * FROM projects WHERE id = ?").get(id) as Project | null) ?? undefined;
  },
  find(nameOrId: string): Project | undefined {
    return (
      this.get(nameOrId) ??
      ((db.query("SELECT * FROM projects WHERE name = ? COLLATE NOCASE OR id = ?").get(nameOrId, slug(nameOrId)) as Project | null) ??
        undefined)
    );
  },
  create(name: string, brief = ""): Project {
    let id = slug(name);
    if (this.get(id)) id = `${id}-${Date.now().toString(36).slice(-4)}`;
    db.run("INSERT INTO projects(id, name, brief, created_at, updated_at) VALUES (?,?,?,?,?)", [id, name, brief, now(), now()]);
    this.dir(id);
    return this.get(id)!;
  },
  setBrief(id: string, brief: string) {
    db.run("UPDATE projects SET brief = ?, updated_at = ? WHERE id = ?", [brief, now(), id]);
  },
  setConversation(id: string, conversationId: string) {
    db.run("UPDATE projects SET conversation_id = ? WHERE id = ?", [conversationId, id]);
  },
  byConversation(conversationId: string): Project | undefined {
    return (db.query("SELECT * FROM projects WHERE conversation_id = ?").get(conversationId) as Project | null) ?? undefined;
  },
  touch(id: string) {
    db.run("UPDATE projects SET updated_at = ? WHERE id = ?", [now(), id]);
  },
  setStatus(id: string, status: "active" | "archived") {
    db.run("UPDATE projects SET status = ?, updated_at = ? WHERE id = ?", [status, now(), id]);
  },
};
