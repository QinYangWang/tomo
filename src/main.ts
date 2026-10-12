import { openAgent } from "./agent/harness.ts";
import { ctx } from "./agent/util.ts";
import { syncAllChannels } from "./channels/manager.ts";
import { runtime } from "./app/settings.ts";
import { config } from "./config.ts";
import { Gateway } from "./gateway/gateway.ts";
import { startScheduler } from "./scheduler/loop.ts";
import { startBackups } from "./backup/backup.ts";
import { startHttp } from "./server/http.ts";

// A misbehaving channel SDK must never take the whole agent down.
process.on("unhandledRejection", (e) => console.error("[unhandled]", e));

const agent = await openAgent();
const gateway = new Gateway(agent);

// Web first, so the settings page is up even while channels connect.
startHttp(gateway);
// Channels and model come from the settings page (env vars still work as a fallback).
await syncAllChannels(gateway);
const stopScheduler = startScheduler(gateway);
const stopBackups = startBackups();

console.log(`[${config.name}] up · model ${runtime.model().provider}/${runtime.model().modelId} · surfaces: ${[...gateway.adapters.keys(), "web"].join(", ")} · web on :${config.http.port}`);

let stopping = false;
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, async () => {
    if (stopping) return;
    stopping = true;
    console.log(`[${config.name}] ${sig}: closing (unfinished work resumes on next start)`);
    stopScheduler();
    stopBackups();
    for (const a of gateway.adapters.values()) await a.stop().catch(() => {});
    await agent.harness.close(ctx);
    process.exit(0);
  });
}
