/**
 * HTTP + WebSocket API for first-party clients (the bundled web/PWA client, and any
 * future iOS/Android/desktop app). Everything is the owner's; auth is one bearer token.
 *
 * REST
 *   GET  /api/conversations              home + bound chats
 *   POST /api/conversations/:id/messages {text}  submit as the owner (goes through the gateway)
 *   GET  /api/projects | /api/memories?q= | /api/schedules | /api/skills
 * WebSocket
 *   /ws?conversation=<id>&token=<t>      server -> client: Pi Durable agent events (first a snapshot)
 *                                        client -> server: {"type":"input","text":"..."} | {"type":"abort"}
 */
import { watchEvents } from "@earendil-works/pi-durable";
import { Hono } from "hono";
import { createBunWebSocket, serveStatic } from "hono/bun";
import { memory } from "../app/memory.ts";
import { projects } from "../app/projects.ts";
import { schedules } from "../app/schedules.ts";
import { skillIndex } from "../agent/extensions/skills.ts";
import { ctx } from "../agent/util.ts";
import { config } from "../config.ts";
import { bindings } from "../gateway/bindings.ts";
import type { Gateway } from "../gateway/gateway.ts";

export function startHttp(gateway: Gateway) {
  const { upgradeWebSocket, websocket } = createBunWebSocket();
  const app = new Hono();
  const home = () => String(gateway.agent.root.id);

  const authed = (token: string | undefined | null) => !config.http.token || token === config.http.token;

  app.use("/api/*", async (c, next) => {
    const h = c.req.header("authorization")?.replace(/^Bearer /, "");
    if (!authed(h)) return c.json({ error: "unauthorized" }, 401);
    await next();
  });

  app.get("/api/conversations", (c) =>
    c.json([{ id: home(), key: "home", platform: "all" }, ...bindings.list().map((b) => ({ id: b.conversation_id, key: b.key, platform: b.platform }))]),
  );

  app.post("/api/conversations/:id/messages", async (c) => {
    const { text } = await c.req.json<{ text: string }>();
    const id = c.req.param("id") === "home" ? home() : c.req.param("id");
    void submitAsOwner(gateway, id, text);
    return c.json({ ok: true });
  });

  app.get("/api/projects", (c) => c.json(projects.list(true)));
  app.get("/api/memories", (c) => c.json(c.req.query("q") ? memory.search(c.req.query("q")!, { limit: 50 }) : memory.recent({ limit: 100 })));
  app.delete("/api/memories/:id", (c) => {
    memory.forget(Number(c.req.param("id")));
    return c.json({ ok: true });
  });
  app.get("/api/schedules", (c) => c.json(schedules.list()));
  app.get("/api/skills", (c) => c.json(skillIndex()));

  app.get(
    "/ws",
    upgradeWebSocket((c) => {
      const ok = authed(c.req.query("token"));
      const id = (c.req.query("conversation") ?? "home") === "home" ? home() : c.req.query("conversation")!;
      let stream: Awaited<ReturnType<typeof watchEvents>> | undefined;
      return {
        async onOpen(_e, ws) {
          if (!ok) return ws.close(4401, "unauthorized");
          stream = await watchEvents(gateway.harness, id as any, ctx);
          ws.send(JSON.stringify([stream.snapshot]));
          stream.start(async (events) => {
            ws.send(JSON.stringify(events));
          });
        },
        async onMessage(e, ws) {
          if (!ok) return;
          const msg = JSON.parse(String(e.data));
          if (msg.type === "input" && msg.text) void submitAsOwner(gateway, id, msg.text);
          if (msg.type === "abort") await (await gateway.harness.conversation(id as any, ctx))?.abort(ctx);
        },
        async onClose() {
          await stream?.stop();
        },
      };
    }),
  );

  app.use("/*", serveStatic({ root: "./web" }));

  Bun.serve({ port: config.http.port, fetch: app.fetch, websocket });
  console.log(`[http] listening on :${config.http.port}`);
}

/** Web input takes the same path as every platform, so commands, routing and reflection all apply. */
async function submitAsOwner(gateway: Gateway, conversationId: string, text: string) {
  await gateway
    .handle({
      platform: "web",
      messageId: crypto.randomUUID(),
      userId: "owner",
      userName: "owner",
      chatId: conversationId,
      isDirect: true,
      conversationId,
      text,
      address: { conversationId },
    })
    .catch((e) => console.error("[web]", e));
}
