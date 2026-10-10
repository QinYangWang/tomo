import { openAgent } from "./agent/harness.ts";
import { ctx } from "./agent/util.ts";
import { DiscordAdapter } from "./channels/discord.ts";
import { SlackAdapter } from "./channels/slack.ts";
import { TelegramAdapter } from "./channels/telegram.ts";
import { config } from "./config.ts";
import { Gateway } from "./gateway/gateway.ts";
import { startScheduler } from "./scheduler/loop.ts";
import { startHttp } from "./server/http.ts";

const agent = await openAgent();
const gateway = new Gateway(agent);

if (config.telegram.token) gateway.register(new TelegramAdapter(config.telegram.token));
if (config.discord.token) gateway.register(new DiscordAdapter(config.discord.token));
if (config.slack.botToken && config.slack.appToken) gateway.register(new SlackAdapter(config.slack.botToken, config.slack.appToken));

await gateway.start();
const stopScheduler = startScheduler(gateway);
startHttp(gateway);

console.log(`[${config.name}] up · model ${config.model.provider}/${config.model.modelId} · surfaces: ${[...gateway.adapters.keys(), "web"].join(", ")}`);

let stopping = false;
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    if (stopping) return;
    stopping = true;
    console.log(`[${config.name}] ${sig}: closing (unfinished work resumes on next start)`);
    stopScheduler();
    for (const a of gateway.adapters.values()) await a.stop().catch(() => {});
    await agent.harness.close(ctx);
    process.exit(0);
  });
}
