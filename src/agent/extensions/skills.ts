/**
 * Skills: markdown playbooks the agent loads on demand and writes for itself.
 *
 * data/skills/<name>/SKILL.md, with a front matter `description:` line. Only the index
 * (name + description) rides in the system prompt; the body is loaded with skill_load.
 * The agent creates and edits skills itself, which is half of how it evolves.
 */
import { Type } from "@earendil-works/pi-ai";
import { defineExtension, defineTool, section } from "@earendil-works/pi-durable";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "../../config.ts";
import { text } from "../util.ts";

mkdirSync(config.skillsDir, { recursive: true });

const NAME = /^[a-z0-9][a-z0-9-]{1,47}$/;
const file = (name: string) => join(config.skillsDir, name, "SKILL.md");

function parse(raw: string) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  const description = m?.[1]?.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? raw.split("\n").find((l) => l.trim())?.slice(0, 160) ?? "";
  return { description, body: m ? raw.slice(m[0].length) : raw };
}

let cache: { at: number; index: { name: string; description: string }[] } | undefined;
export function skillIndex() {
  const dirMtime = statSync(config.skillsDir).mtimeMs;
  if (cache && cache.at >= dirMtime && Date.now() - cache.at < 30_000) return cache.index;
  const index = readdirSync(config.skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(file(d.name)))
    .map((d) => ({ name: d.name, description: parse(readFileSync(file(d.name), "utf8")).description }))
    .sort((a, b) => a.name.localeCompare(b.name));
  cache = { at: Date.now(), index };
  return index;
}

function write(name: string, content: string) {
  mkdirSync(join(config.skillsDir, name), { recursive: true });
  const f = file(name);
  if (existsSync(f)) {
    // Keep the previous version: evolution should be reversible.
    const hist = join(config.skillsDir, name, ".history");
    mkdirSync(hist, { recursive: true });
    renameSync(f, join(hist, `${Date.now()}.md`));
  }
  writeFileSync(f, content);
  cache = undefined;
}

const skillLoad = defineTool({
  name: "skill_load",
  description: "Load a skill's full instructions before doing the task it covers. Loading is cheap; load whenever a skill might apply.",
  parameters: Type.Object({ name: Type.String() }),
  replay: "safe",
  execute: async ({ name }) => {
    if (!existsSync(file(name))) return text(`No skill "${name}".`, true);
    return text(readFileSync(file(name), "utf8"));
  },
});

const skillSave = defineTool({
  name: "skill_save",
  description:
    "Create or replace a skill: a reusable procedure, template, or set of conventions you learned. Include a one-line description of when to use it. The previous version is kept.",
  parameters: Type.Object({
    name: Type.String({ description: "kebab-case" }),
    description: Type.String(),
    body: Type.String({ description: "Markdown instructions." }),
  }),
  replay: "safe",
  execute: async ({ name, description, body }) => {
    if (!NAME.test(name)) return text("Name must be kebab-case, 2-48 chars.", true);
    write(name, `---\ndescription: ${description.replace(/\n/g, " ")}\n---\n${body}\n`);
    return text(`Saved skill "${name}".`);
  },
});

const skillEdit = defineTool({
  name: "skill_edit",
  description: "Exact find/replace inside a skill. `find` must match exactly once.",
  parameters: Type.Object({ name: Type.String(), find: Type.String(), replace: Type.String() }),
  replay: "safe",
  execute: async ({ name, find, replace }) => {
    if (!existsSync(file(name))) return text(`No skill "${name}".`, true);
    const raw = readFileSync(file(name), "utf8");
    const count = raw.split(find).length - 1;
    if (count !== 1) return text(`find matched ${count} times; it must match exactly once.`, true);
    write(name, raw.replace(find, replace));
    return text(`Edited skill "${name}".`);
  },
});

export const Skills = defineExtension({
  name: "skills",
  tools: [skillLoad, skillSave, skillEdit],
  sections: [
    section("skills", () => {
      const idx = skillIndex();
      if (!idx.length) return "No skills yet. Save one with skill_save when you work out a reusable procedure.";
      return `Load a skill with skill_load before a task it covers:\n${idx.map((s) => `- ${s.name}: ${s.description}`).join("\n")}`;
    }),
  ],
});
