import { Type } from "@earendil-works/pi-ai";
import { configure, defineExtension, defineTool, section } from "@earendil-works/pi-durable";
import { projects } from "../../app/projects.ts";
import { MetaDoc, text } from "../util.ts";

const projectList = defineTool({
  name: "project_list",
  description: "List the user's projects.",
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
    "Create a project for a multi-step effort (a trip, a launch, a job search). Give it a brief: goal and scope, important files, standing rules (when X do Y), open threads. Then it becomes this conversation's active project.",
  parameters: Type.Object({ name: Type.String(), brief: Type.String() }),
  execute: async (args, api, context) => {
    const p = projects.create(args.name, args.brief);
    await api.commit(async (tx) => {
      (await tx.doc(MetaDoc, api.conversationId)).projectId = p.id;
      await configure(tx, api.conversationId, { cwd: projects.dir(p.id) });
    }, context);
    return text(`Created project "${p.name}" (${p.id}); it is now active here. Its workspace directory is the working directory for file tools.`);
  },
});

const projectOpen = defineTool({
  name: "project_open",
  description: "Make an existing project this conversation's active project (or pass 'none' to leave projects).",
  parameters: Type.Object({ project: Type.String() }),
  replay: "safe",
  execute: async (args, api, context) => {
    if (args.project === "none") {
      await api.commit(async (tx) => {
        delete (await tx.doc(MetaDoc, api.conversationId)).projectId;
        await configure(tx, api.conversationId, { cwd: null });
      }, context);
      return text("Left the project.");
    }
    const p = projects.find(args.project);
    if (!p) return text(`No project named "${args.project}".`, true);
    await api.commit(async (tx) => {
      (await tx.doc(MetaDoc, api.conversationId)).projectId = p.id;
      await configure(tx, api.conversationId, { cwd: projects.dir(p.id) });
    }, context);
    return text(`Opened "${p.name}".`);
  },
});

const projectBrief = defineTool({
  name: "project_update_brief",
  description:
    "Replace the active project's brief. Keep it current, unprompted, whenever the goal, files, standing rules, decisions or open threads change. Core inline, bulky detail in files under the project directory.",
  parameters: Type.Object({ brief: Type.String() }),
  replay: "safe",
  execute: async (args, api, context) => {
    const meta = await api.snapshot(MetaDoc, api.conversationId, context);
    if (!meta?.projectId) return text("No active project.", true);
    projects.setBrief(meta.projectId, args.brief);
    return text("Brief updated.");
  },
});

const projectArchive = defineTool({
  name: "project_archive",
  description: "Archive a finished project.",
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
  tools: [projectList, projectCreate, projectOpen, projectBrief, projectArchive],
  sections: [
    section("project", async (input, context) => {
      const meta = await input.read.snapshot(MetaDoc, input.conversationId, context);
      if (!meta?.projectId) return undefined;
      const p = projects.get(meta.projectId);
      if (!p) return undefined;
      return `Active project: ${p.name} (id ${p.id}). Working directory: ${projects.dir(p.id)}\nBrief (consult before acting, keep current with project_update_brief):\n${p.brief || "(empty: write one as soon as the purpose is clear)"}`;
    }),
  ],
});
