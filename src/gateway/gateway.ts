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
import { projects } from "../app/projects.ts";
import { config } from "../config.ts";
import { ctx, messageText, MetaDoc } from "../agent/util.ts";
import { bindings, routes } from "./bindings.ts";
import { chunk, type ChannelAdapter, type Inbound } from "./types.ts";

export class Gateway {
  readonly adapters = new Map<string, ChannelAdapter>();
  /** Conversations with a run this process is delivering. Later messages steer into it. */
  private inflight = new Map<string, Promise<void>>();

  constructor(readonly agent: Agent) {}

  get harness(): Harness {
    return this.agent.harness;
  }

  register(adapter: ChannelAdapter) {
    this.adapters.set(adapter.platform, adapter);
  }

  async start() {
    for (const a of this.adapters.values()) {
      await a.start((m) => this.handle(m).catch((e) => console.error(`[${a.platform}]`, e)));
      console.log(`[gateway] ${a.platform} connected`);
    }
  }

  role(platform: string, userId: string): "owner" | "allowed" | "stranger" {
    const id = `${platform}:${userId}`;
    if (platform === "web" || config.owners.includes(id)) return "owner";
    if (config.allowed.includes(id)) return "allowed";
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
        { ownership: { kind: "ownerless" }, agent: { model: config.model }, init: undefined },
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
    const parent = (await this.harness.conversation(chatConv as any, ctx))!;
    const view = await parent.viewState(ctx);
    const last = view.value.entries.at(-1);
    view.dispose();
    const thread = last
      ? await parent.fork(last.id, { ownership: { kind: "ownerless" } }, ctx)
      : await this.harness.createConversation({ ownership: { kind: "ownerless" }, agent: { model: config.model } }, ctx);
    bindings.set(threadKey, String(thread.id), m.platform);
    return String(thread.id);
  }

  async handle(m: Inbound) {
    const adapter = this.adapters.get(m.platform);
    const role = this.role(m.platform, m.userId);
    if (role === "stranger") {
      if (m.isDirect && config.owners.length === 0) {
        await adapter?.send(m.address, `No owner configured yet. Your id is ${m.platform}:${m.userId}. Add it to TOMO_OWNERS and restart.`);
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

    const content = m.isDirect && role === "owner" ? m.text : `[${m.userName} on ${m.platform}] ${m.text}`;
    const conv = (await this.harness.conversation(convId as any, ctx))!;
    const requestId = `${m.platform}:${m.chatId}:${m.messageId}`;

    // Already delivering a run here: this message joins it (steer) and that run's answer covers it.
    if (this.inflight.has(convId)) {
      await conv.submit({ type: "input", content, requestId, whenBusy: "steer" }, ctx);
      return;
    }

    const work = (async () => {
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
      }
    })();
    this.inflight.set(convId, work);
    try {
      await work;
    } finally {
      this.inflight.delete(convId);
    }
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
    const conv = (await this.harness.conversation(convId as any, ctx))!;
    switch (cmd) {
      case "/help":
        return "/new · /stop · /status · /model <provider>/<id> · /project <name|none> · /plugins · /approve <name> · /reject <name> · /whoami";
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
      case "/project": {
        if (!arg) return projects.list().map((p) => `- ${p.name} (${p.id})`).join("\n") || "No projects.";
        const p = arg === "none" ? undefined : projects.find(arg);
        if (arg !== "none" && !p) return `No project "${arg}".`;
        await conv.commit(async (tx) => {
          const meta = await tx.doc(MetaDoc, conv.id);
          if (p) meta.projectId = p.id;
          else delete meta.projectId;
          await configure(tx, conv.id, { cwd: p ? projects.dir(p.id) : null });
        }, ctx);
        return p ? `Now in project ${p.name}.` : "Left the project.";
      }
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
