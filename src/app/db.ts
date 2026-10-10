/**
 * Application database: everything that is not a transcript.
 *
 * The harness owns harness.sqlite (transcripts, tasks, documents). This file owns app.sqlite:
 * who is who across platforms, which chat maps to which conversation, projects, long-term
 * memory, and schedules. Kept separate so the harness storage stays single-owner and the app
 * tables can be queried and migrated freely.
 */
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "../config.ts";

mkdirSync(dirname(config.appDb), { recursive: true });
export const db = new Database(config.appDb, { create: true });
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

const MIGRATIONS: string[] = [
  `
  -- A chat on some platform -> one harness conversation.
  CREATE TABLE bindings (
    key             TEXT PRIMARY KEY,          -- e.g. "telegram:chat:123", "slack:C01:thread:1700.1", "owner:home"
    conversation_id TEXT NOT NULL,
    platform        TEXT NOT NULL,
    created_at      INTEGER NOT NULL
  );
  CREATE INDEX bindings_conv ON bindings(conversation_id);

  -- Where to deliver proactive messages (reminders, reports) for a conversation.
  CREATE TABLE routes (
    conversation_id TEXT PRIMARY KEY,
    platform        TEXT NOT NULL,
    address         TEXT NOT NULL,             -- JSON: the adapter's own address (chat id, channel + thread...)
    updated_at      INTEGER NOT NULL
  );

  CREATE TABLE projects (
    id          TEXT PRIMARY KEY,              -- slug
    name        TEXT NOT NULL,
    brief       TEXT NOT NULL DEFAULT '',      -- standing brief: goal, scope, files, rules, open threads
    status      TEXT NOT NULL DEFAULT 'active',
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );

  -- Long-term memory. Each row is one durable statement about the user's world.
  CREATE TABLE memories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    kind        TEXT NOT NULL,                 -- profile | preference | person | place | fact | decision | episode
    subject     TEXT NOT NULL,                 -- who/what it is about: "user", "Dana Reyes", "kitchen-remodel"
    content     TEXT NOT NULL,
    scope       TEXT NOT NULL DEFAULT 'global',-- 'global' or a project id
    confidence  TEXT NOT NULL DEFAULT 'stated',-- stated (user said it) | inferred (agent concluded it)
    source      TEXT,                          -- conversation id it came from
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    archived    INTEGER NOT NULL DEFAULT 0
  );
  CREATE VIRTUAL TABLE memories_fts USING fts5(subject, content, content='memories', content_rowid='id', tokenize='trigram');
  CREATE TRIGGER memories_ai AFTER INSERT ON memories BEGIN
    INSERT INTO memories_fts(rowid, subject, content) VALUES (new.id, new.subject, new.content);
  END;
  CREATE TRIGGER memories_ad AFTER DELETE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, subject, content) VALUES ('delete', old.id, old.subject, old.content);
  END;
  CREATE TRIGGER memories_au AFTER UPDATE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, subject, content) VALUES ('delete', old.id, old.subject, old.content);
    INSERT INTO memories_fts(rowid, subject, content) VALUES (new.id, new.subject, new.content);
  END;

  CREATE TABLE schedules (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    title           TEXT NOT NULL,
    prompt          TEXT NOT NULL,             -- what the agent receives when it fires
    kind            TEXT NOT NULL,             -- once | interval | daily | cron
    spec            TEXT NOT NULL,             -- ISO time | seconds | "HH:MM" | cron expr
    next_run        INTEGER,                   -- epoch ms, NULL when finished
    last_run        INTEGER,
    status          TEXT NOT NULL DEFAULT 'active',
    created_at      INTEGER NOT NULL
  );
  CREATE INDEX schedules_due ON schedules(status, next_run);

  -- Per-conversation counters for the evolution loop.
  CREATE TABLE conversation_stats (
    conversation_id TEXT PRIMARY KEY,
    turns           INTEGER NOT NULL DEFAULT 0,
    last_reflected  INTEGER NOT NULL DEFAULT 0
  );
  `,
];

db.exec("CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY)");
const applied = new Set((db.query("SELECT version FROM _migrations").all() as { version: number }[]).map((r) => r.version));
MIGRATIONS.forEach((sql, i) => {
  if (applied.has(i)) return;
  db.transaction(() => {
    db.exec(sql);
    db.run("INSERT INTO _migrations(version) VALUES (?)", [i]);
  })();
});

export const now = () => Date.now();
