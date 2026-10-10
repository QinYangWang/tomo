/**
 * Projects. Each project is its own conversation with its own memory and brief.
 *
 * From the owner's chats the agent only knows which projects exist (name, status) and can
 * start one; it never sees a project's brief, memory or transcript. Inside a project the agent
 * sees that project's brief and keeps it current.
 */
import { Type } from "@earendil-works/pi-ai";
import { defineExtension, defineTool, section } from "@earendil-works/pi-durable";
import { projects } from "../../app/projects.ts";
import { MetaDoc, text } from "../util.ts";

const projectList = defineTool({
  name: "project_list",
  description: "List the owner's projects (names and status only).",
  parameters: Type.Object({ includeArchived: Type.Optional(Type.Boolean()) }),
  replay: "safe",
  execute: async (args) => {
    const rows = projects.list(args.includeArchived);
    return text(rows.length ? rows.map((p) => `- ${p.name} (id: ${p.id}, ${p.status})`).join("\n") : "No projects yet.");
  },
});

const projectCreate = defineTool({
  name: "project_create",
  description:
    "Start a new project for a multi-step effort (a trip, a launch, a job search) when the owner agrees. It opens as its own fresh thread with its own memory; the owner continues in it from Projects. Pass only a name: details belong inside the project, not here.",
  parameters: Type.Object({ name: Type.String() }),
  execute: async (args, api, context) => {
    const meta = await api.snapshot(MetaDoc, api.conversationId, context);
    if (meta?.projectId) return text("You are inside a project; new projects are started from the owner's chats or the Projects page.", true);
    const p = projects.create(args.name);
    return text(`Created project "${p.name}" (${p.id}). It starts fresh: tell the owner to open it under Projects to begin.`);
  },
});

const projectBrief = defineTool({
  name: "project_update_brief",
  description:
    "Replace this project's brief. Keep it current, unprompted, whenever the goal, files, standing rules, decisions or open threads change. Core inline, bulky detail in files under the project directory.",
  parameters: Type.Object({ brief: Type.String() }),
  replay: "safe",
  execute: async (args, api, context) => {
    const meta = await api.snapshot(MetaDoc, api.conversationId, context);
    if (!meta?.projectId) return text("Only a project's own thread can edit its brief.", true);
    projects.setBrief(meta.projectId, args.brief);
    return text("Brief updated.");
  },
});

const projectArchive = defineTool({
  name: "project_archive",
  description: "Archive a finished project, when the owner asks.",
  parameters: Type.Object({ project: Type.String() }),
  replay: "safe",
  execute: async (args) => {
    const p = projects.find(args.project);
    if (!p) return text(`No project named "${args.project}".`, true);
    projects.setStatus(p.id, "archived");
    return text(`Archived "${p.name}".`);
  },
});

export const Projects = defineExtension({
  name: "projects",
  tools: [projectList, projectCreate, projectBrief, projectArchive],
  sections: [
    section("project", async (input, context) => {
      const meta = await input.read.snapshot(MetaDoc, input.conversationId, context);
      if (meta?.projectId) {
        const p = projects.get(meta.projectId);
        if (!p) return undefined;
        return `You are working inside the project "${p.name}" (id ${p.id}). This thread, its memory and its brief belong to this project only. Working directory: ${projects.dir(p.id)}
Brief (consult before acting, keep current with project_update_brief):
${p.brief || "(empty: this project just started. Learn what it is for, then write the brief.)"}`;
      }
      const rows = projects.list();
      if (!rows.length) return "Projects: none yet. Suggest one for a multi-step effort; each project is its own thread with its own memory.";
      return `The owner's projects (each is its own thread; you don't see inside them, so for project details point the owner to that project):\n${rows.map((p) => `- ${p.name}`).join("\n")}`;
    }),
  ],
});
