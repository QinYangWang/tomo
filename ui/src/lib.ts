export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const ago = (ms: number) => {
  const d = (Date.now() - ms) / 1000;
  if (d < 60) return "刚刚";
  if (d < 3600) return `${Math.floor(d / 60)} 分钟前`;
  if (d < 86400) return `${Math.floor(d / 3600)} 小时前`;
  return `${Math.floor(d / 86400)} 天前`;
};
export const when = (ms: number) => {
  const d = new Date(ms), now = new Date();
  const t = d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  const days = Math.round((+new Date(d.toDateString()) - +new Date(now.toDateString())) / 86400000);
  return days === 0 ? `今天 ${t}` : days === 1 ? `明天 ${t}` : days === -1 ? `昨天 ${t}` : `${d.getMonth() + 1}月${d.getDate()}日 ${t}`;
};
export const CADENCE: Record<string, string> = { none: "不自动刷新", hourly: "每小时刷新", daily: "每天刷新", weekly: "每周刷新" };
export const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? "夜深了" : h < 11 ? "早上好" : h < 14 ? "中午好" : h < 18 ? "下午好" : "晚上好";
};

/** Tiny markdown for assistant text and panels. Escapes first, so the output is safe to inject. */
export function md(src: string): string {
  const blocks: string[] = [];
  src = src.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, _l, code: string) => `\u0000${blocks.push(`<pre><code>${esc(code.replace(/\n$/, ""))}</code></pre>`) - 1}\u0000`);
  const inline = (s: string) =>
    esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  const out: string[] = [];
  let list: { t: "ul" | "ol"; start?: string; items: string[] } | null = null;
  const flush = () => {
    if (list) out.push(`<${list.t}${list.t === "ol" ? ` start="${list.start}"` : ""}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.t}>`);
    list = null;
  };
  for (const line of src.split("\n")) {
    if (!line.trim()) continue;
    const ul = line.match(/^\s*[-*•]\s+(.*)/), ol = line.match(/^\s*(\d+)[.)]\s+(.*)/), h = line.match(/^#{1,4}\s+(.*)/);
    if (ul || ol) {
      const t = ul ? "ul" : "ol";
      if (list && (list as { t: string }).t !== t) flush();
      list ??= { t, start: ol?.[1], items: [] };
      list.items.push(ul ? ul[1]! : ol![2]!);
      continue;
    }
    flush();
    if (h) out.push(`<h4>${inline(h[1]!)}</h4>`);
    else if (/^\u0000\d+\u0000$/.test(line.trim())) out.push(line.trim());
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  flush();
  return out.join("").replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[Number(i)]!);
}

/** First line of real content in a project brief, shown under its title. */
export function briefLine(brief?: string) {
  for (const l of String(brief ?? "").split("\n")) {
    const t = l.replace(/^\s*(#+|[-*•]|\d+[.)]|\[[ x]\])\s*/i, "").replace(/[*_`]/g, "").trim();
    if (t && !/^#/.test(l.trim())) return t;
  }
  return "";
}

const TOOL_NAMES: Record<string, string> = {
  remember: "记下一件事", recall: "翻记忆", forget: "删除记忆", update_memory: "更新记忆",
  project_create: "新建项目", project_brief: "更新项目简报", project_switch: "切换项目", project_list: "看项目列表", project_rename: "给项目起名",
  skill_save: "保存技能", skill_edit: "改进技能", skill_read: "读技能",
  schedule_create: "设定定时任务", schedule_cancel: "取消定时任务", schedule_list: "看定时任务",
  panel_publish: "更新 Home 面板", panel_list: "看面板", panel_remove: "移除面板",
  subagent: "派出子任务", search_history: "翻聊天记录", fetch_url: "打开网页", handoff: "转交",
  bash: "运行命令", read: "读文件", write: "写文件", edit: "改文件",
};
export const toolLabel = (name: string, args?: any) => {
  const base = TOOL_NAMES[name] ?? name;
  const hint = args?.url ?? args?.query ?? args?.title ?? args?.name ?? args?.command ?? args?.path ?? "";
  return hint ? `${base} · ${String(hint).slice(0, 60)}` : base;
};

export const UNTITLED = "Untitled project";
export const pname = (p: { name: string }) => (p.name === UNTITLED ? "未命名项目" : p.name);
