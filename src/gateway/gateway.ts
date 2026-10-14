/**
 * The gateway: every platform's messages come in here, get routed to a durable
 * conversation, and the answer goes back out.
 *
 * Routing:
 *   owner, direct message, any platform  -> the harness root ("home"): one continuous conversation
 *   a group chat / channel               -> its own conversation
 *   a thread in that channel             -> a fork of the channel's conversation at the latest entry
 */
import { AssistantEntry, configure, type Harness } from "@earendil-works/pi-durable";
import type { Agent } from "../agent/harness.ts";
import { noteTurn } from "../agent/evolve/reflection.ts";
import { pluginAdmin } from "../agent/evolve/plugins.ts";
import { panels, type Panel } from "../app/panels.ts";
import { fallbackTitle, projects, UNTITLED } from "../app/projects.ts";
import { afterTurn, beforeTurn } from "../git/repos.ts";
import { pairingCodes, runtime } from "../app/settings.ts";
import { cid, ctx, messageText, MetaDoc, roleOf } from "../agent/util.ts";
import { bindings, cursors, routes } from "./bindings.ts";
import { after, chunk, contextBlock, type ChannelAdapter, type ContextLine, type Inbound } from "./types.ts";

export class Gateway {
  readonly adapters = new Map<string, ChannelAdapter>();
  /** Conversations with a run this process is delivering. Later messages steer into it. */
  private inflight = new Map<string, Promise<void>>();
  /** Strangers already told why a group mention got no answer. */
  private hinted = new Set<string>();

  constructor(readonly agent: Agent) {}

  get harness(): Harness {
    return this.agent.harness;
  }

  register(adapter: ChannelAdapter) {
    this.adapters.set(adapter.platform, adapter);
  }

  /** Start one adapter (used when a channel is connected from the settings page). */
  async attach(adapter: ChannelAdapter) {
    await this.detach(adapter.platform);
    await adapter.start((m) => this.handle(m).catch((e) => console.error(`[${adapter.platform}]`, e)));
    this.adapters.set(adapter.platform, adapter);
    console.log(`[gateway] ${adapter.platform} connected`);
  }

  async detach(platform: string) {
    const a = this.adapters.get(platform);
    if (!a) return;
    this.adapters.delete(platform);
    await a.stop().catch((e) => console.error(`[${platform}] stop`, e));
    console.log(`[gateway] ${platform} disconnected`);
  }

  /** Point every user-facing conversation at the default model chosen in settings. */
  async applyDefaultModel() {
    const model = runtime.model();
    const ids = [String(this.agent.root.id), ...bindings.list().map((b) => b.conversation_id), ...projects.list(true).flatMap((p) => (p.conversation_id ? [p.conversation_id] : []))];
    for (const id of new Set(ids)) {
      const conv = await this.harness.conversation(cid(id), ctx);
      await conv?.configure({ model }, ctx).catch((e: unknown) => console.error("[model]", id, e));
    }
  }

  async start() {
    for (const a of this.adapters.values()) {
      await a.start((m) => this.handle(m).catch((e) => console.error(`[${a.platform}]`, e)));
      console.log(`[gateway] ${a.platform} connected`);
    }
  }

  role(platform: string, userId: string): "owner" | "allowed" | "stranger" {
    const id = `${platform}:${userId}`;
    if (platform === "web" || runtime.owners().includes(id)) return "owner";
    if (runtime.allowed().includes(id)) return "allowed";
    return "stranger";
  }

  /** Find or create the conversation for a message. */
  async conversationFor(m: Inbound, role: string): Promise<string> {
    if (m.conversationId) return m.conversationId;
    if (role === "owner" && m.isDirect) return String(this.agent.root.id);

    const chatKey = `${m.platform}:chat:${m.chatId}`;
    let chatConv: string | undefined = bindings.get(chatKey);
    if (!chatConv) {
      const c = await this.harness.createConversation(
        { ownership: { kind: "ownerless" }, agent: { model: runtime.model() }, init: undefined },
        ctx,
      );
      await c.commit(async (tx) => {
        Object.assign(await tx.doc(MetaDoc, c.id), { kind: "group", title: chatKey });
      }, ctx);
      bindings.set(chatKey, String(c.id), m.platform);
      chatConv = String(c.id);
    }
    if (!m.threadId) return chatConv;

    const threadKey = `${chatKey}:thread:${m.threadId}`;
    const existing = bindings.get(threadKey);
    if (existing) return existing;
    const parent = (await this.harness.conversation(cid(chatConv), ctx))!;
    const view = await parent.viewState(ctx);
    const last = view.value.entries.at(-1);
    view.dispose();
    const thread = last
      ? await parent.fork(last.id, { ownership: { kind: "ownerless" } }, ctx)
      : await this.harness.createConversation({ ownership: { kind: "ownerless" }, agent: { model: runtime.model() } }, ctx);
    bindings.set(threadKey, String(thread.id), m.platform);
    return String(thread.id);
  }

  async handle(m: Inbound) {
    const adapter = this.adapters.get(m.platform);
    const role = this.role(m.platform, m.userId);
    if (role === "stranger") {
      if (!m.isDirect) {
        // Silently ignoring a mention looks like a broken bot: say why, once per person per run.
        console.log(`[gateway] ignored ${m.platform} mention from ${m.userName} (${m.platform}:${m.userId}): not paired or allowed`);
        if (!this.hinted.has(`${m.platform}:${m.userId}`)) {
          this.hinted.add(`${m.platform}:${m.userId}`);
          const paired = runtime.owners().some((o) => o.startsWith(`${m.platform}:`));
          await adapter?.send(m.address, paired
            ? "I only answer my owner and people they've allowed here. Ask them to add you in Settings."
            : "Not paired yet. Open Settings on the web, get a pairing code, then DM me /pair <code>. After that I'll answer here.");
        }
        return;
      }
      // Pairing: the owner gets a one-time code on the web settings page and sends "/pair <code>" here.
      const pair = m.text.trim().match(/^\/pair\s+(\d{6})$/);
      if (pair && pairingCodes.redeem(pair[1]!)) {
        runtime.addOwner(`${m.platform}:${m.userId}`);
        await adapter?.send(m.address, "Paired. This account is now yours: DMs here join your Home conversation.");
      } else if (runtime.owners().length === 0 || pair) {
        await adapter?.send(m.address, pair ? "That code is wrong or expired. Get a new one in Settings → Owner." : "Not paired yet. Open Settings → Owner on the web, get a code, and send /pair <code> here.");
      }
      return;
    }

    const convId = await this.conversationFor(m, role);
    // Web clients watch conversations live; proactive output keeps going to the last messaging app.
    if (m.platform !== "web" || !routes.get(convId)) routes.set(convId, m.platform, m.address);

    if (m.text.startsWith("/") && role === "owner") {
      const reply = await this.command(convId, m.text);
      if (reply !== undefined) {
        await this.deliver(convId, reply);
        return;
      }
    }

    const proj = projects.byConversation(convId);
    if (proj) projects.touch(proj.id);
    const said = m.isDirect && role === "owner" ? m.text : `[${m.userName} on ${m.platform}] ${m.text}`;
    const earlier = m.isDirect ? "" : await this.groupContext(m, adapter);
    const content = earlier ? `${earlier}\n\n${said}` : said;
    const conv = (await this.harness.conversation(cid(convId), ctx))!;
    const requestId = `${m.platform}:${m.chatId}:${m.messageId}`;

    // Already delivering a run here: this message joins it (steer) and that run's answer covers it.
    if (this.inflight.has(convId)) {
      await conv.submit({ type: "input", content, requestId, whenBusy: "steer" }, ctx);
      return;
    }

    const work = (async () => {
      if (proj) await beforeTurn(proj.id, projects.dir(proj.id)).catch((e) => console.error("[git] before turn", e));
      const typing = setInterval(() => this.typing(convId), 4_000);
      this.typing(convId);
      try {
        const sub = await conv.submit({ type: "input", content, requestId, whenBusy: "steer" }, ctx);
        const settled = await sub.wait(ctx);
        if (settled.status === "done" && settled.type === "input" && settled.answer) {
          const entry = await conv.commit((tx) => tx.entry(AssistantEntry, settled.answer!), ctx);
          const answer = messageText(entry as any);
          if (answer) await this.deliver(convId, answer);
          noteTurn(this.harness, convId);
        } else if (settled.status === "unanswered") {
          await this.deliver(convId, `(no answer: ${(settled as any).reason ?? "unknown"})`);
        }
      } finally {
        clearInterval(typing);
        // Everything the agent changed in the project's folder becomes a commit, saved to storage.
        if (proj) await afterTurn(proj.id, projects.dir(proj.id), fallbackTitle(m.text)).catch((e) => console.error("[git] after turn", e));
        // The project agent names an untitled project on its first turn; if it didn't, use the message itself.
        if (proj && projects.get(proj.id)?.name === UNTITLED) projects.rename(proj.id, fallbackTitle(m.text));
      }
    })();
    this.inflight.set(convId, work);
    try {
      await work;
    } finally {
      this.inflight.delete(convId);
    }
  }

  /**
   * What was said in a group chat or thread since the agent last saw it, so a mention mid-discussion
   * arrives with the discussion. Best effort: a platform error or missing permission just means no context.
   */
  async groupContext(m: Inbound, adapter = this.adapters.get(m.platform)): Promise<string> {
    if (!adapter?.context) return m.replyTo ? contextBlock([], m.replyTo) : "";
    const key = `${m.platform}:chat:${m.chatId}${m.threadId ? `:thread:${m.threadId}` : ""}`;
    const seen = cursors.get(key);
    let lines: ContextLine[] = [];
    try {
      lines = (await adapter.context(m, seen)).filter((l) => !seen || after(l.id, seen));
    } catch (e) {
      console.error(`[${m.platform}] context`, (e as Error).message);
    }
    const here = m.position ?? lines.at(-1)?.id;
    if (here && (!seen || after(here, seen))) cursors.set(key, here);
    // Slack keys a reply thread by its parent message, and the agent has seen that one already.
    if (!m.threadId && m.position) cursors.set(`${key}:thread:${m.position}`, m.position);
    return contextBlock(lines, m.replyTo);
  }

  /** The background conversation panels are built in, so their work never shows up in a chat. */
  private async panelConversation() {
    const key = "system:panels";
    const id = bindings.get(key);
    if (id) {
      const c = await this.harness.conversation(cid(id), ctx);
      if (c) return c;
    }
    const c = await this.harness.createConversation({ ownership: { kind: "ownerless" }, agent: { model: runtime.model() } }, ctx);
    await c.commit(async (tx) => {
      Object.assign(await tx.doc(MetaDoc, c.id), { kind: "system", title: "Home panels" });
    }, ctx);
    bindings.set(key, String(c.id), "system");
    return c;
  }

  /** Build or refresh one panel. Resolves when the run settles. */
  async buildPanel(p: Panel, reason: "create" | "refresh" | "edit", instruction?: string) {
    if (reason !== "refresh") panels.setStatus(p.id, "building");
    const conv = await this.panelConversation();
    const lines = [
      `[Home panel ${p.id}] ${reason === "create" ? "New panel" : reason === "edit" ? "Change this panel" : "Scheduled refresh"}.`,
      `What the owner wants on it: ${p.request}`,
      instruction ? `Requested change: ${instruction}` : "",
      reason !== "create" && p.body ? `Current card:\n${p.body}` : "",
      `Gather current, real values with your tools (memory, schedules, projects, fetch_url, ...). Never invent a value: when a source can't be reached, say so on the card.`,
      `Then call panel_publish with id "${p.id}". Reply with one short line after publishing.`,
    ].filter(Boolean);
    const sub = await conv.submit({ type: "input", content: lines.join("\n"), requestId: `panel:${p.id}:${reason}:${Date.now()}`, whenBusy: "followUp" }, ctx);
    const settled = await sub.wait(ctx);
    const now = panels.get(p.id);
    if (now && now.status === "building") {
      const why = settled.status === "done" && settled.type === "input" && settled.answer ? messageText({ model: [settled.answer] } as any) : (settled as any).reason ?? settled.status;
      panels.setStatus(p.id, "error", String(why || "Tomo didn't publish the panel").slice(0, 300));
    }
  }

  /** A project's own conversation, created fresh (never forked) the first time it is opened. */
  async projectConversation(projectId: string): Promise<string> {
    const p = projects.get(projectId);
    if (!p) throw new Error(`no project ${projectId}`);
    if (p.conversation_id && (await this.harness.conversation(cid(p.conversation_id), ctx))) return p.conversation_id;
    const c = await this.harness.createConversation({ ownership: { kind: "ownerless" }, agent: { model: runtime.model() } }, ctx);
    await c.commit(async (tx) => {
      Object.assign(await tx.doc(MetaDoc, c.id), { kind: "project", projectId: p.id, title: p.name });
      await configure(tx, c.id, { cwd: projects.dir(p.id) });
    }, ctx);
    projects.setConversation(p.id, String(c.id));
    return String(c.id);
  }

  /** Text search over a conversation's whole transcript, newest first. */
  async searchHistory(convId: string, needle: string, limit = 30) {
    const conv = await this.harness.conversation(cid(convId), ctx);
    if (!conv) return [];
    const q = needle.toLowerCase();
    const hits: { entryId: string; role: string; text: string; at: number | null }[] = [];
    let cursor: any = undefined;
    for (let page = 0; page < 50 && hits.length < limit; page++) {
      const res: any = await conv.commit((tx: any) => tx.scanEntries({ conversationId: conv.id, order: "descending" }, 200, cursor), ctx);
      for (const e of res.items) {
        const r = roleOf(e);
        if (r !== "user" && r !== "assistant") continue;
        const t = messageText(e);
        if (!t.toLowerCase().includes(q)) continue;
        const ts = (e.model?.[0] as any)?.timestamp ?? null;
        hits.push({ entryId: String(e.id), role: r, text: t.slice(0, 600), at: ts });
        if (hits.length >= limit) break;
      }
      if (!res.next) break;
      cursor = res.next;
    }
    return hits;
  }

  private typing(convId: string) {
    const r = routes.get(convId);
    if (r) this.adapters.get(r.platform)?.typing?.(r.address).catch(() => {});
  }

  /** Send text to wherever this conversation was last reached from. */
  async deliver(convId: string, text: string) {
    const r = routes.get(convId);
    if (!r) return;
    const a = this.adapters.get(r.platform);
    if (!a) return; // web clients watch the conversation directly
    for (const part of chunk(text, a.maxLength)) await a.send(r.address, part);
  }

  /** Owner commands. Returns undefined to pass the text through to the agent. */
  async command(convId: string, raw: string): Promise<string | undefined> {
    const [cmd, ...rest] = raw.trim().split(/\s+/);
    const arg = rest.join(" ");
    const conv = (await this.harness.conversation(cid(convId), ctx))!;
    switch (cmd) {
      case "/help":
        return "/new · /stop · /status · /model <provider>/<id> · /project · /plugins · /approve <name> · /reject <name> · /whoami";
      case "/new":
        await conv.reset(undefined, ctx);
        return "Fresh context. Memory and history are kept.";
      case "/stop":
        await conv.abort(ctx);
        return "Stopped.";
      case "/model": {
        const [provider, ...id] = arg.split("/");
        if (!provider || !id.length) return "Usage: /model anthropic/claude-sonnet-5-5";
        await conv.configure({ model: { provider, modelId: id.join("/") } }, ctx);
        return `Model set to ${provider}/${id.join("/")} for this conversation.`;
      }
      case "/project":
        return (projects.list().map((p) => `- ${p.name}`).join("\n") || "No projects.") + "\n\nEach project is its own thread: open it under Projects on the web.";
      case "/status": {
        const agent = await conv.agent(ctx);
        const meta = await this.harness.snapshot(MetaDoc, conv.id, ctx);
        const usage = await this.harness.usage(ctx);
        const cost = Object.values((usage as any).models ?? {}).reduce((s: number, u: any) => s + (u?.cost?.total ?? 0), 0);
        return `model ${(agent as any).model?.provider}/${(agent as any).model?.modelId} · project ${meta?.projectId ?? "none"} · total spend $${cost.toFixed(2)}`;
      }
      case "/plugins":
        return `pending: ${pluginAdmin.pending().join(", ") || "none"}\nactive: ${pluginAdmin.active().join(", ") || "none"}${
          arg ? `\n\n${pluginAdmin.show(arg) ?? "not found"}` : ""
        }`;
      case "/approve":
        return pluginAdmin.approve(arg) ? `Approved ${arg}; loading.` : `No pending plugin "${arg}".`;
      case "/reject":
        return pluginAdmin.reject(arg) ? `Rejected ${arg}.` : `No pending plugin "${arg}".`;
      case "/whoami":
        return `conversation ${convId}`;
      default:
        return undefined;
    }
  }
}

