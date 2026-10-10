import { Type } from "@earendil-works/pi-ai";
import { defineExtension, defineTool } from "@earendil-works/pi-durable";
import { panels } from "../../app/panels.ts";
import { text } from "../util.ts";

const publish = defineTool({
  name: "panel_publish",
  description: `Publish a card on the owner's Home page, or update one. Use it when a request carries "[Home panel <id>]", or when the owner asks you to put something on Home (call with no id to make a new one).
body: glanceable markdown, at most ~8 short lines: the number or status first, then a few supporting lines. No preamble, no sources list.
cadence: how often the content really changes. none | hourly | daily | weekly. Pick the slowest honest one.`,
  parameters: Type.Object({
    id: Type.Optional(Type.String()),
    title: Type.String({ description: "2-6 words" }),
    body: Type.String(),
    cadence: Type.Optional(Type.Union([Type.Literal("none"), Type.Literal("hourly"), Type.Literal("daily"), Type.Literal("weekly")])),
    request: Type.Optional(Type.String({ description: "For a new panel: what it tracks, so refreshes can redo it." })),
  }),
  execute: async (args) => {
    try {
      const id = args.id ?? panels.create(args.request ?? args.title).id;
      const p = panels.publish(id, { title: args.title, body: args.body, cadence: args.cadence });
      return text(`Panel ${p.id} "${p.title}" is live on Home${p.cadence !== "none" ? `, refreshing ${p.cadence}` : ""}.`);
    } catch (e) {
      return text(String(e), true);
    }
  },
});

const list = defineTool({
  name: "panel_list",
  description: "List the panels on the owner's Home page.",
  parameters: Type.Object({}),
  replay: "safe",
  execute: async () => {
    const rows = panels.list();
    return text(rows.length ? rows.map((p) => `- ${p.id} "${p.title}" (${p.status}, ${p.cadence}): ${p.request}`).join("\n") : "No panels.");
  },
});

const remove = defineTool({
  name: "panel_remove",
  description: "Remove a panel from Home, only when the owner asks.",
  parameters: Type.Object({ id: Type.String() }),
  execute: async ({ id }) => {
    panels.remove(id);
    return text(`Removed ${id}.`);
  },
});

export const Panels = defineExtension({ name: "panels", tools: [publish, list, remove] });
