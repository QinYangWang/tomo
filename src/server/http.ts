/**
 * HTTP + WebSocket API for first-party clients (the bundled React PWA in ui/, and any
 * future iOS/Android/desktop app). Everything is the owner's.
 *
 * Auth: on first start there is no password; the web client shows a setup screen
 * (POST /api/auth/setup). After that, POST /api/auth/login returns a session token used as
 * "Authorization: Bearer <token>" (and ?token= on the WebSocket). TOMO_API_TOKEN, if set,
 * is also accepted, for scripts and headless setups.
 *
 * Settings (all configuration lives here, not in .env)
 *   GET    /api/settings                          providers (key set? last4), models, channels + status, owners
 *   PUT    /api/settings/providers/:id  {key}     save a provider API key      DELETE removes it
 *   POST   /api/settings/providers/:id/test {modelId?}
 *   GET    /api/settings/models?provider=         chat models a provider offers
 *   PUT    /api/settings/model {model, smallModel}  default models ({provider, modelId})
 *   PUT    /api/settings/channels/:id {enabled, ...tokens}  save + (re)connect that channel now
 *   POST   /api/settings/pair                     one-time code; DM "/pair <code>" to the bot
 *   DELETE /api/settings/owners/:id
 *   PUT    /api/settings/password {current, next}
 *   PUT    /api/settings/profile {name?, nickname?, birthday?, ...}  owner profile, "" clears a field
 *   PUT    /api/settings/onboarded {done}         first-run guide finished or skipped
 *
 * REST
 *   GET  /api/conversations              home + bound chats
 *   POST /api/conversations/:id/messages {text}  submit as the owner (goes through the gateway)
 *   GET  /api/projects | /api/projects/:id (ensures its own conversation) | /api/memories?q=&scope= | /api/schedules | /api/skills
 *   POST /api/projects {name?} (new "Untitled project", fresh thread) · PATCH /api/projects/:id {status?, name?} · DELETE /api/projects/:id
 *   DELETE /api/memories/:id | /api/schedules/:id
 *   GET/POST /api/panels · POST /api/panels/:id/refresh · PUT /api/panels/:id {instruction} · DELETE /api/panels/:id
 *   GET  /api/history?q=&conversation=   transcript search
 *   GET  /api/projects/:id/git             repository info (storage, last commits, clone URL path)
 *   GET  /api/settings/storage · PUT /api/settings/storage {s3: {...}|null} · POST /api/settings/storage/test {s3}
 *   GET  /api/settings/backup · PUT /api/settings/backup {enabled} · POST /api/settings/backup/run · GET /api/settings/backup/code
 * Git (smart HTTP, HTTP Basic: any user name, password = the login password or a session token)
 *   GET  /git/<project id>.git/info/refs?service=git-upload-pack|git-receive-pack
 *   POST /git/<project id>.git/git-upload-pack | git-receive-pack
 * WebSocket
 *   /ws?conversation=<id>&token=<t>      server -> client: Pi Durable agent events (first a snapshot)
 *                                        client -> server: {"type":"input","text":"..."} | {"type":"abort"}
 */
import { watchEvents } from "@earendil-works/pi-durable";
import { Hono } from "hono";
import { createBunWebSocket, serveStatic } from "hono/bun";
import { memory } from "../app/memory.ts";
import { panels } from "../app/panels.ts";
import { projects } from "../app/projects.ts";
import { schedules } from "../app/schedules.ts";
import { skillIndex } from "../agent/extensions/skills.ts";
import { cid, ctx } from "../agent/util.ts";
import { auth, CHANNELS, channelSettings, pairingCodes, profile, runtime, secrets, settings, type ChannelId, type ModelRef } from "../app/settings.ts";
import { PROVIDERS } from "../agent/providers.ts";
import { channelStatus, syncChannel } from "../channels/manager.ts";
import { config } from "../config.ts";
import { bindings } from "../gateway/bindings.ts";
import type { Gateway } from "../gateway/gateway.ts";
import { backupNow, backupSettings, KEEP, list as listBackups, recoveryCode } from "../backup/backup.ts";
import { advertise, info as repoInfo, removeRepo, rpc, setStorage, storageSettings, testStorage } from "../git/repos.ts";

const ENV_KEYS: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GEMINI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  xai: "XAI_API_KEY",
  groq: "GROQ_API_KEY",
  mistral: "MISTRAL_API_KEY",
};

/** Provider errors are often JSON nested in JSON; dig out the human sentence. */
function cleanError(raw: string): string {
  let s = raw;
  for (let i = 0; i < 4; i++) {
    try {
      const j = JSON.parse(s);
      const next = j?.error?.message ?? j?.message ?? j?.error;
      if (typeof next !== "string") break;
      s = next;
    } catch {
      break;
    }
  }
  return s.trim().slice(0, 300);
}

export function startHttp(gateway: Gateway) {
  const { upgradeWebSocket, websocket } = createBunWebSocket();
  const app = new Hono();
  const home = () => String(gateway.agent.root.id);

  const authed = (token: string | undefined | null) => auth.checkSession(token);
  const bearer = (c: { req: { header(n: string): string | undefined } }) => c.req.header("authorization")?.replace(/^Bearer /, "");

  // ---- auth (public) ----
  app.get("/api/auth/status", (c) => c.json({ setup: !auth.hasPassword(), authed: authed(bearer(c)), name: config.name }));
  app.post("/api/auth/setup", async (c) => {
    if (auth.hasPassword()) return c.json({ error: "already set up" }, 409);
    const { password } = await c.req.json<{ password: string }>();
    if (!password || password.length < 8) return c.json({ error: "password must be at least 8 characters" }, 400);
    await auth.setPassword(password);
    return c.json({ token: auth.newSession() });
  });
  app.post("/api/auth/login", async (c) => {
    const { password } = await c.req.json<{ password: string }>();
    if (!(await auth.verify(password ?? ""))) {
      await Bun.sleep(800); // slow down guessing
      return c.json({ error: "wrong password" }, 401);
    }
    return c.json({ token: auth.newSession() });
  });

  app.use("/api/*", async (c, next) => {
    if (c.req.path.startsWith("/api/auth/")) return next();
    if (!authed(bearer(c))) return c.json({ error: "unauthorized" }, 401);
    await next();
  });
  app.post("/api/auth/logout", (c) => {
    const t = bearer(c);
    if (t) auth.endSession(t);
    return c.json({ ok: true });
  });

  // ---- settings ----
  const models = gateway.agent.models;
  const chatModels = (provider: string) =>
    models.getModels(provider).map((m: any) => ({ id: m.id, name: m.name ?? m.id, contextWindow: m.contextWindow }));

  app.get("/api/settings", (c) =>
    c.json({
      providers: PROVIDERS.map((p) => ({
        id: p.id,
        label: p.label,
        hint: p.hint,
        key: secrets.preview(`provider:${p.id}`),
        fromEnv: !secrets.has(`provider:${p.id}`) && !!process.env[ENV_KEYS[p.id] ?? ""],
      })),
      model: runtime.model(),
      smallModel: runtime.smallModel(),
      channels: (Object.keys(CHANNELS) as ChannelId[]).map((id) => ({
        id,
        enabled: settings.get<boolean>(`channel:${id}:enabled`, true),
        fields: Object.fromEntries(
          CHANNELS[id].fields.map((f) => [f, secrets.has(`channel:${id}:${f}`) ? secrets.preview(`channel:${id}:${f}`) : { set: !!channelSettings.values(id)[f], fromEnv: !!channelSettings.values(id)[f] }]),
        ),
        status: channelStatus(id),
      })),
      owners: runtime.owners(),
      ownersFromEnv: config.owners,
      profile: profile.get(),
      onboarded: settings.get<boolean>("onboarded", false),
    }),
  );

  app.get("/api/settings/models", (c) => c.json(chatModels(c.req.query("provider") ?? "")));

  app.put("/api/settings/providers/:id", async (c) => {
    const id = c.req.param("id");
    if (!PROVIDERS.some((p) => p.id === id)) return c.json({ error: "unknown provider" }, 404);
    const { key } = await c.req.json<{ key: string }>();
    if (!key?.trim()) return c.json({ error: "key is empty" }, 400);
    secrets.set(`provider:${id}`, key.trim());
    return c.json({ ok: true, key: secrets.preview(`provider:${id}`) });
  });
  app.delete("/api/settings/providers/:id", (c) => {
    secrets.delete(`provider:${c.req.param("id")}`);
    return c.json({ ok: true });
  });

  app.post("/api/settings/providers/:id/test", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json<{ modelId?: string }>().catch(() => ({}) as { modelId?: string });
    const current = runtime.model();
    const model =
      (body.modelId && models.getModel(id, body.modelId)) ||
      (current.provider === id && models.getModel(id, current.modelId)) ||
      models.getModels(id).find((m: any) => !/research|image|live|computer|tts|audio|embed|search|batch/i.test(m.id)) ||
      models.getModels(id)[0];
    if (!model) return c.json({ ok: false, error: "this provider lists no models" });
    try {
      const res = await models.completeSimple(model, { messages: [{ role: "user", content: "Reply with: ok", timestamp: Date.now() }] }, {
        maxTokens: 32,
        signal: AbortSignal.timeout(30_000),
      } as any);
      if (res.stopReason === "error" || res.stopReason === "aborted") return c.json({ ok: false, model: model.id, error: cleanError(res.errorMessage ?? res.stopReason) });
      return c.json({ ok: true, model: model.id });
    } catch (e) {
      return c.json({ ok: false, model: model.id, error: cleanError(e instanceof Error ? e.message : String(e)) });
    }
  });

  app.put("/api/settings/model", async (c) => {
    const body = await c.req.json<{ model?: ModelRef; smallModel?: ModelRef }>();
    for (const [k, v] of Object.entries(body) as [string, ModelRef | undefined][]) {
      if (!v) continue;
      if (!models.getModel(v.provider, v.modelId)) return c.json({ error: `unknown model ${v.provider}/${v.modelId}` }, 400);
      settings.set(k, { provider: v.provider, modelId: v.modelId });
    }
    if (body.model) await gateway.applyDefaultModel();
    return c.json({ ok: true, model: runtime.model(), smallModel: runtime.smallModel() });
  });

  app.put("/api/settings/channels/:id", async (c) => {
    const id = c.req.param("id") as ChannelId;
    if (!(id in CHANNELS)) return c.json({ error: "unknown channel" }, 404);
    const body = await c.req.json<Record<string, unknown>>();
    for (const f of CHANNELS[id].fields) {
      const v = body[f];
      if (typeof v === "string" && v.trim()) secrets.set(`channel:${id}:${f}`, v.trim());
      if (v === null) secrets.delete(`channel:${id}:${f}`);
    }
    if (typeof body.enabled === "boolean") settings.set(`channel:${id}:enabled`, body.enabled);
    return c.json({ status: await syncChannel(gateway, id) });
  });

  app.put("/api/settings/profile", async (c) => c.json({ profile: profile.update(await c.req.json<Record<string, unknown>>()) }));
  app.put("/api/settings/onboarded", async (c) => {
    const { done } = await c.req.json<{ done?: boolean }>().catch(() => ({ done: true }));
    settings.set("onboarded", done !== false);
    return c.json({ ok: true });
  });

  app.post("/api/settings/pair", (c) => c.json(pairingCodes.issue()));
  app.delete("/api/settings/owners/:id", (c) => {
    runtime.removeOwner(c.req.param("id"));
    return c.json({ owners: runtime.owners() });
  });

  app.put("/api/settings/password", async (c) => {
    const { current, next } = await c.req.json<{ current: string; next: string }>();
    if (!(await auth.verify(current ?? ""))) return c.json({ error: "wrong password" }, 401);
    if (!next || next.length < 8) return c.json({ error: "password must be at least 8 characters" }, 400);
    await auth.setPassword(next);
    return c.json({ token: auth.newSession() });
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
  // ?scope=<project id> reads that project's own memory; default is the owner's chats ("global").
  app.get("/api/memories", (c) => {
    const scope = c.req.query("scope") || undefined;
    return c.json(c.req.query("q") ? memory.search(c.req.query("q")!, { scope, limit: 50 }) : memory.recent({ scope, limit: 100 }));
  });
  app.delete("/api/memories/:id", (c) => {
    memory.forget(Number(c.req.param("id")));
    return c.json({ ok: true });
  });
  // Each project is its own thread: opening one makes sure its conversation exists.
  app.get("/api/projects/:id", async (c) => {
    const p = projects.get(c.req.param("id"));
    if (!p) return c.json({ error: "not found" }, 404);
    const conversation_id = await gateway.projectConversation(p.id);
    return c.json({ ...p, conversation_id });
  });
  app.post("/api/projects", async (c) => {
    const { name } = await c.req.json<{ name?: string }>().catch(() => ({ name: undefined }));
    const p = projects.create(name?.trim() || undefined);
    const conversation_id = await gateway.projectConversation(p.id);
    return c.json({ ...projects.get(p.id)!, conversation_id });
  });
  app.patch("/api/projects/:id", async (c) => {
    const p = projects.get(c.req.param("id"));
    if (!p) return c.json({ error: "not found" }, 404);
    const { status, name } = await c.req.json<{ status?: "active" | "archived"; name?: string }>();
    if (status) projects.setStatus(p.id, status);
    if (name?.trim()) projects.rename(p.id, name);
    return c.json(projects.get(p.id));
  });
  app.delete("/api/projects/:id", async (c) => {
    await removeRepo(c.req.param("id")).catch((e) => console.error("[git] remove", e));
    projects.remove(c.req.param("id"));
    return c.json({ ok: true });
  });
  // Home panels
  app.get("/api/panels", (c) => c.json(panels.list()));
  app.post("/api/panels", async (c) => {
    const { request } = await c.req.json<{ request: string }>();
    if (!request?.trim()) return c.json({ error: "Say what the panel should show" }, 400);
    const p = panels.create(request.trim());
    void gateway.buildPanel(p, "create").catch((e) => panels.setStatus(p.id, "error", String(e)));
    return c.json(p);
  });
  app.post("/api/panels/:id/refresh", (c) => {
    const p = panels.get(c.req.param("id"));
    if (!p) return c.json({ error: "not found" }, 404);
    panels.setStatus(p.id, "building");
    void gateway.buildPanel(p, "refresh").catch((e) => panels.setStatus(p.id, "error", String(e)));
    return c.json({ ok: true });
  });
  app.put("/api/panels/:id", async (c) => {
    const p = panels.get(c.req.param("id"));
    if (!p) return c.json({ error: "not found" }, 404);
    const { instruction } = await c.req.json<{ instruction: string }>();
    void gateway.buildPanel(p, "edit", instruction).catch((e) => panels.setStatus(p.id, "error", String(e)));
    return c.json({ ok: true });
  });
  app.delete("/api/panels/:id", (c) => {
    panels.remove(c.req.param("id"));
    return c.json({ ok: true });
  });

  // Full-text search over a conversation's transcript (default: Home)
  app.get("/api/history", async (c) => {
    const q = c.req.query("q")?.trim();
    if (!q) return c.json([]);
    const conv = c.req.query("conversation");
    const id = !conv || conv === "home" ? String(gateway.agent.root.id) : conv;
    return c.json(await gateway.searchHistory(id, q));
  });

  app.get("/api/schedules", (c) => c.json(schedules.list()));
  app.delete("/api/schedules/:id", (c) => {
    schedules.cancel(c.req.param("id"));
    return c.json({ ok: true });
  });
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
          try {
            stream = await watchEvents(gateway.harness, cid(id), ctx);
            ws.send(JSON.stringify([stream.snapshot]));
            stream.start(async (events) => {
              ws.send(JSON.stringify(events));
            });
          } catch (e) {
            console.error("[ws]", id, e);
            ws.close(4404, "no such conversation");
          }
        },
        async onMessage(e, ws) {
          if (!ok) return;
          const msg = JSON.parse(String(e.data));
          if (msg.type === "input" && msg.text) void submitAsOwner(gateway, id, msg.text);
          if (msg.type === "abort") await (await gateway.harness.conversation(cid(id), ctx))?.abort(ctx);
        },
        async onClose() {
          await stream?.stop();
        },
      };
    }),
  );

  // ---- storage for project repositories ----
  app.get("/api/settings/storage", (c) => c.json(storageSettings.view()));
  app.post("/api/settings/storage/test", async (c) => {
    const { s3 } = await c.req.json<{ s3: any }>();
    try {
      await testStorage(s3);
      return c.json({ ok: true });
    } catch (e) {
      return c.json({ ok: false, error: (e as Error).message.slice(0, 300) });
    }
  });
  app.put("/api/settings/storage", async (c) => {
    const { s3 } = await c.req.json<{ s3: any }>();
    try {
      const r = await setStorage(s3 ?? null);
      return c.json({ ok: true, copied: r.copied, ...storageSettings.view() });
    } catch (e) {
      return c.json({ ok: false, error: (e as Error).message.slice(0, 300) }, 400);
    }
  });
  // ---- backups ----
  const backupView = async () => ({
    enabled: backupSettings.enabled(),
    last: backupSettings.last(),
    keep: KEEP,
    storage: storageSettings.view().kind,
    list: await listBackups().catch(() => []),
  });
  app.get("/api/settings/backup", async (c) => c.json(await backupView()));
  app.put("/api/settings/backup", async (c) => {
    const { enabled } = await c.req.json<{ enabled?: boolean }>();
    if (typeof enabled === "boolean") backupSettings.setEnabled(enabled);
    return c.json(await backupView());
  });
  app.post("/api/settings/backup/run", async (c) => {
    const last = await backupNow();
    return c.json({ ...(await backupView()), ok: last.ok, error: last.error });
  });
  app.get("/api/settings/backup/code", (c) => c.json({ code: recoveryCode() }));
  app.get("/api/projects/:id/git", async (c) => {
    const p = projects.get(c.req.param("id"));
    if (!p) return c.json({ error: "not found" }, 404);
    return c.json({ ...(await repoInfo(p.id, projects.dir(p.id))), path: `/git/${encodeURIComponent(p.id)}.git` });
  });

  // ---- git smart HTTP ----
  const gitAuth = async (h: string | undefined) => {
    if (!h?.startsWith("Basic ")) return false;
    const raw = Buffer.from(h.slice(6), "base64").toString();
    const pass = raw.slice(raw.indexOf(":") + 1);
    return authed(pass) || (await auth.verify(pass));
  };
  const deny = () => new Response("Tomo: sign in with your Tomo password\n", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Tomo"' } });
  const repoOf = (name: string) => {
    const id = decodeURIComponent(name).replace(/\.git$/, "");
    return projects.get(id) ? id : null;
  };
  const SERVICES = ["git-upload-pack", "git-receive-pack"] as const;
  app.get("/git/:repo/info/refs", async (c) => {
    if (!(await gitAuth(c.req.header("authorization")))) return deny();
    const id = repoOf(c.req.param("repo"));
    const svc = c.req.query("service") as (typeof SERVICES)[number];
    if (!id) return c.text("no such project", 404);
    if (!SERVICES.includes(svc)) return c.text("dumb HTTP is not supported", 403);
    try {
      const body = await advertise(id, svc, c.req.header("git-protocol"));
      return new Response(body, { headers: { "content-type": `application/x-${svc}-advertisement`, "cache-control": "no-cache" } });
    } catch (e) {
      console.error("[git]", e);
      return c.text(`Tomo: ${(e as Error).message}`, 500);
    }
  });
  for (const svc of SERVICES) {
    app.post(`/git/:repo/${svc}`, async (c) => {
      if (!(await gitAuth(c.req.header("authorization")))) return deny();
      const id = repoOf(c.req.param("repo"));
      if (!id) return c.text("no such project", 404);
      let body = new Uint8Array(await c.req.arrayBuffer());
      if (c.req.header("content-encoding") === "gzip") body = Bun.gunzipSync(body);
      try {
        const out = await rpc(id, svc, body, { protocol: c.req.header("git-protocol"), by: "owner" });
        return new Response(out, { headers: { "content-type": `application/x-${svc}-result`, "cache-control": "no-cache" } });
      } catch (e) {
        console.error("[git]", e);
        return c.text(`Tomo: ${(e as Error).message}`, 500);
      }
    });
  }

  // The React client (ui/, built to ui/dist). Unknown paths fall back to index.html so deep links work.
  app.use("/*", serveStatic({ root: "./ui/dist" }));
  app.get("*", serveStatic({ path: "./ui/dist/index.html" }));

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
