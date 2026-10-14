import { db, now } from "../app/db.ts";

export const bindings = {
  get(key: string): string | undefined {
    return (db.query("SELECT conversation_id FROM bindings WHERE key = ?").get(key) as { conversation_id: string } | null)?.conversation_id;
  },
  set(key: string, conversationId: string, platform: string) {
    db.run("INSERT OR REPLACE INTO bindings(key, conversation_id, platform, created_at) VALUES (?,?,?,?)", [key, conversationId, platform, now()]);
  },
  list(): { key: string; conversation_id: string; platform: string; created_at: number }[] {
    return db.query("SELECT * FROM bindings WHERE platform != 'system' ORDER BY created_at DESC").all() as any;
  },
};

/** Last surface a conversation was reached from: where proactive output goes. */
export const routes = {
  set(conversationId: string, platform: string, address: unknown) {
    db.run("INSERT OR REPLACE INTO routes(conversation_id, platform, address, updated_at) VALUES (?,?,?,?)", [
      conversationId,
      platform,
      JSON.stringify(address),
      now(),
    ]);
  },
  get(conversationId: string): { platform: string; address: any } | undefined {
    const r = db.query("SELECT platform, address FROM routes WHERE conversation_id = ?").get(conversationId) as
      | { platform: string; address: string }
      | null;
    return r ? { platform: r.platform, address: JSON.parse(r.address) } : undefined;
  },
};

/** Group chats: the last platform message the agent has seen, so context is never sent twice. */
export const cursors = {
  get(key: string): string | undefined {
    return (db.query("SELECT position FROM chat_cursors WHERE key = ?").get(key) as { position: string } | null)?.position;
  },
  set(key: string, position: string) {
    db.run("INSERT OR REPLACE INTO chat_cursors(key, position, updated_at) VALUES (?,?,?)", [key, position, now()]);
  },
};
