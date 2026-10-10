// Tomo web client. No build step: plain DOM, one file.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
let token = localStorage.token || "";

async function api(path, opts = {}) {
  const r = await fetch(path, {
    ...opts,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: opts.body && typeof opts.body !== "string" ? JSON.stringify(opts.body) : opts.body,
  });
  if (r.status === 401 && !path.startsWith("/api/auth/")) {
    gate();
    throw new Error("unauthorized");
  }
  return r.json();
}
function toast(text) {
  $("toast").textContent = text;
  $("toast").hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => ($("toast").hidden = true), 2200);
}
const ago = (ms) => {
  const d = (Date.now() - ms) / 1000;
  if (d < 60) return "刚刚";
  if (d < 3600) return `${Math.floor(d / 60)} 分钟前`;
  if (d < 86400) return `${Math.floor(d / 3600)} 小时前`;
  return `${Math.floor(d / 86400)} 天前`;
};
const when = (ms) => {
  const d = new Date(ms), now = new Date();
  const t = d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  const days = Math.round((new Date(d.toDateString()) - new Date(now.toDateString())) / 86400000);
  return days === 0 ? `今天 ${t}` : days === 1 ? `明天 ${t}` : `${d.getMonth() + 1}月${d.getDate()}日 ${t}`;
};

// ---------- tiny markdown (assistant messages) ----------
function md(src) {
  const blocks = [];
  src = src.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, _l, code) => `\u0000${blocks.push(`<pre><code>${esc(code.replace(/\n$/, ""))}</code></pre>`) - 1}\u0000`);
  const inline = (s) =>
    esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  const out = [];
  let list = null;
  const flush = () => { if (list) { out.push(`<${list.t}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.t}>`); list = null; } };
  for (const para of src.split(/\n{2,}/)) {
    for (const line of para.split("\n")) {
      const ul = line.match(/^\s*[-*•]\s+(.*)/), ol = line.match(/^\s*\d+[.)]\s+(.*)/), h = line.match(/^#{1,4}\s+(.*)/);
      if (ul || ol) {
        const t = ul ? "ul" : "ol";
        if (list && list.t !== t) flush();
        list ??= { t, items: [] };
        list.items.push((ul ?? ol)[1]);
        continue;
      }
      flush();
      if (h) out.push(`<h4>${inline(h[1])}</h4>`);
      else if (/^\u0000\d+\u0000$/.test(line.trim())) out.push(line.trim());
      else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    }
    flush();
  }
  return out.join("").replace(/<p>(.*?)<\/p>(?=<p>)/g, "<p>$1</p>").replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[i]);
}

// ---------- gate ----------
let setupMode = false;
async function gate() {
  const s = await (await fetch("/api/auth/status", { headers: { authorization: `Bearer ${token}` } })).json();
  if (s.authed) return boot(false);
  setupMode = s.setup;
  $("gate").hidden = false;
  $("gateTitle").textContent = setupMode ? "欢迎使用 Tomo" : "Tomo";
  $("gateSub").textContent = setupMode ? "先设一个密码。之后模型、平台都在网页里配。" : "输入密码继续";
  $("pw2").hidden = !setupMode;
  $("gateBtn").textContent = setupMode ? "开始" : "登录";
  $("pw").focus();
}
$("gateForm").onsubmit = async (e) => {
  e.preventDefault();
  const password = $("pw").value;
  if (setupMode && password !== $("pw2").value) return ($("gateErr").textContent = "两次输入不一致");
  const r = await (await fetch(setupMode ? "/api/auth/setup" : "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) })).json();
  if (!r.token) return ($("gateErr").textContent = r.error === "wrong password" ? "密码不对" : r.error);
  token = localStorage.token = r.token;
  $("pw").value = $("pw2").value = $("gateErr").textContent = "";
  $("gate").hidden = true;
  boot(setupMode);
};

// ---------- navigation ----------
let view = "chat";
function go(v) {
  view = v;
  for (const s of document.querySelectorAll(".view")) s.classList.toggle("on", s.id === `v-${v}`);
  for (const b of document.querySelectorAll("#tabs button")) b.classList.toggle("on", b.dataset.view === v);
  $("homeBtn").classList.toggle("on", v === "home");
  if (v === "home") renderHome();
  if (v === "projects") renderProjects();
  if (v === "chat") setTimeout(() => ($("thread").scrollTop = 1e9));
}
$("homeBtn").onclick = () => go("home");
for (const b of document.querySelectorAll("#tabs button")) b.onclick = () => go(b.dataset.view);

// ---------- chat ----------
let current = "home", ws, live = null, work = null, typing = null, convs = [];
const textOf = (msgs) => (msgs ?? []).flatMap((m) => (typeof m.content === "string" ? [m.content] : (m.content ?? []).filter((c) => c.type === "text").map((c) => c.text))).join("");
const TOOL_NAMES = {
  remember: "记下一件事", recall: "翻记忆", forget: "删除记忆", update_memory: "更新记忆",
  project_create: "新建项目", project_brief: "更新项目简报", project_switch: "切换项目", project_list: "看项目列表",
  skill_save: "保存技能", skill_edit: "改进技能", skill_read: "读技能",
  schedule: "设定定时任务", schedule_cancel: "取消定时任务", schedule_list: "看定时任务",
  subagent: "派出子任务", search_history: "翻聊天记录", fetch_url: "打开网页", handoff: "转交",
  bash: "运行命令", read: "读文件", write: "写文件", edit: "改文件",
};
const toolLabel = (name, args) => {
  const base = TOOL_NAMES[name] ?? name;
  const hint = args?.url ?? args?.query ?? args?.name ?? args?.title ?? args?.command ?? args?.path ?? "";
  return hint ? `${base} · ${String(hint).slice(0, 60)}` : base;
};

function add(el) {
  $("log").append(el);
  if (typing) $("log").append(typing);
  $("thread").scrollTop = 1e9;
  return el;
}
function bubble(cls, text) {
  const d = document.createElement("div");
  d.className = `b ${cls}`;
  if (cls === "ai") d.innerHTML = md(text);
  else d.textContent = text;
  return add(d);
}
function workCard() {
  if (work) return work;
  const d = document.createElement("details");
  d.className = "work";
  d.innerHTML = `<summary><span class="spin"></span><span class="label">正在处理</span><span class="when"></span></summary><ol></ol>`;
  d.steps = 0;
  work = add(d);
  return work;
}
function step(label) {
  const w = workCard();
  w.steps++;
  const li = document.createElement("li");
  li.textContent = label;
  w.querySelector("ol").append(li);
  w.querySelector(".label").textContent = w.classList.contains("done") ? `用了 ${w.steps} 个步骤` : `正在处理 · ${label}`;
}
function finishWork() {
  if (!work) return;
  work.classList.add("done");
  work.querySelector(".label").textContent = `用了 ${work.steps} 个步骤`;
  work = null;
}
function setTyping(on) {
  if (on && !typing) {
    typing = document.createElement("div");
    typing.className = "typing";
    typing.innerHTML = "<i></i><i></i><i></i>";
    add(typing);
  } else if (!on && typing) {
    typing.remove();
    typing = null;
  }
}
function renderEntry(e, fromSnapshot) {
  if (e.kind === "pi.user") {
    finishWork();
    bubble("me", textOf(e.model));
  } else if (e.kind === "pi.assistant") {
    for (const m of e.model ?? []) for (const c of m.content ?? []) if (c.type === "toolCall" && fromSnapshot) step(toolLabel(c.name, c.arguments));
    const t = textOf(e.model);
    if (t) {
      finishWork();
      bubble("ai", t);
    }
  }
}
function connect(id) {
  ws?.close();
  $("log").innerHTML = "";
  live = work = typing = null;
  current = id;
  const c = convs.find((x) => x.id === id || (id === "home" && x.key === "home"));
  $("convName").textContent = c && c.key !== "home" ? c.key : "Home";
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const sock = (ws = new WebSocket(`${proto}://${location.host}/ws?conversation=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`));
  sock.onmessage = (ev) => {
    for (const e of JSON.parse(ev.data)) {
      if (e.type === "snapshot") {
        $("log").innerHTML = "";
        work = typing = null;
        e.entries.forEach((x) => renderEntry(x, true));
        finishWork();
        if (!e.entries.length) $("log").innerHTML = `<div class="empty">这是你和 Tomo 的 Home 对话。<br/>在 Telegram、Discord、Slack 私聊它，也会出现在这里。</div>`;
      } else if (e.type === "run_start") setTyping(true);
      else if (e.type === "message_start" && e.message?.role === "assistant") { live = null; }
      else if (e.type === "message_update") {
        for (const c of e.changes ?? []) if (c.type === "text_delta") {
          if (!live) { setTyping(false); finishWork(); live = bubble("ai", ""); live.raw = ""; }
          live.raw += c.delta;
          live.innerHTML = md(live.raw);
          $("thread").scrollTop = 1e9;
        }
      } else if (e.type === "message_end") {
        $("log").querySelector(".empty")?.remove();
        if (e.entry?.kind === "pi.user") renderEntry(e.entry);
        else if (e.entry?.kind === "pi.assistant") {
          const t = textOf(e.entry.model);
          if (live) live.innerHTML = md(t);
          else if (t) { setTyping(false); finishWork(); bubble("ai", t); }
        }
        live = null;
      } else if (e.type === "tool_execution_start") { setTyping(false); step(toolLabel(e.toolName, e.args)); setTyping(true); }
      else if (e.type === "auto_retry_start") toast(`模型出错，正在重试：${String(e.errorMessage).slice(0, 80)}`);
      else if (e.type === "run_end") { setTyping(false); finishWork(); }
    }
  };
  sock.onclose = (ev) => {
    if (ev.code === 4401) return gate();
    setTimeout(() => ws === sock && connect(id), 2000);
  };
}
$("composer").onsubmit = (ev) => {
  ev.preventDefault();
  const text = $("t").value.trim();
  if (!text || ws?.readyState !== 1) return;
  ws.send(JSON.stringify({ type: "input", text }));
  $("t").value = "";
  $("t").style.height = "";
};
$("t").addEventListener("input", () => { $("t").style.height = ""; $("t").style.height = Math.min($("t").scrollHeight, 180) + "px"; });
$("t").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing && matchMedia("(pointer:fine)").matches) { e.preventDefault(); $("composer").requestSubmit(); } };
$("convPick").onclick = async () => {
  convs = await api("/api/conversations");
  sheet("对话", (body) => {
    body.innerHTML = `<div class="group">${convs.map((c) => `<button class="item" data-id="${c.key === "home" ? "home" : esc(c.id)}"><span class="grow">${c.key === "home" ? "🏠 Home <span class='muted small'>· 所有平台的私聊</span>" : esc(c.key)}</span>${(c.key === "home" ? "home" : c.id) === current ? "✓" : ""}</button>`).join("")}</div><p class="note">群聊和频道各有自己的对话，线程从频道对话分叉。</p>`;
    body.querySelectorAll("[data-id]").forEach((b) => (b.onclick = () => { closeSheet(); connect(b.dataset.id); go("chat"); }));
  });
};

// ---------- Home ----------
async function renderHome() {
  const h = new Date().getHours();
  $("hello").textContent = h < 5 ? "夜深了" : h < 11 ? "早上好" : h < 14 ? "中午好" : h < 18 ? "下午好" : "晚上好";
  $("today").textContent = new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });
  const [S, sch, ps, mem, sk] = await Promise.all([api("/api/settings"), api("/api/schedules"), api("/api/projects"), api("/api/memories"), api("/api/skills")]);
  const panels = [];
  const hasKey = S.providers.some((p) => p.key.set || p.fromEnv);
  const connected = S.channels.filter((c) => c.status.state === "connected");
  if (!hasKey) panels.push(`<button class="panel wide cta" data-go="settings:models"><h3>开始</h3><div class="big">接上一个 AI 模型</div><div class="sub">填任意一家的 API key，Tomo 就能开始干活</div></button>`);
  else if (!connected.length) panels.push(`<button class="panel wide cta" data-go="settings:channels"><h3>下一步</h3><div class="big">连上一个消息平台</div><div class="sub">Telegram、Discord 或 Slack，填 token 就能上线</div></button>`);
  else if (!S.owners.length) panels.push(`<button class="panel wide cta" data-go="settings:profile"><h3>下一步</h3><div class="big">配对你的账号</div><div class="sub">让机器人认出你，私聊会进 Home 对话</div></button>`);
  const next = sch[0];
  panels.push(`<button class="panel" data-go="settings:schedules"><h3>⏰ 接下来</h3>${next ? `<div class="big">${esc(when(next.next_run))}</div><div class="line">${esc(next.title)}</div><div class="sub">共 ${sch.length} 个定时任务</div>` : `<div class="line muted">没有定时任务</div><div class="sub">在对话里说「每天早上 8 点提醒我…」</div>`}</button>`);
  panels.push(`<button class="panel" data-go="projects"><h3>📁 项目</h3>${ps.length ? `<div class="big">${ps.length} 个进行中</div><div class="line">${ps.slice(0, 3).map((p) => esc(p.name)).join(" · ")}</div>` : `<div class="line muted">还没有项目</div><div class="sub">说「帮我开个项目：…」</div>`}</button>`);
  panels.push(`<button class="panel wide" data-go="settings:memory"><h3>🧠 最近记住的</h3>${mem.length ? mem.slice(0, 3).map((m) => `<div class="line">${esc(m.content)}</div>`).join("") + `<div class="sub">共 ${mem.length} 条 · 最近 ${ago(mem[0].updated_at)}</div>` : `<div class="line muted">还没有记忆。聊得越多，Tomo 越懂你。</div>`}</button>`);
  panels.push(`<button class="panel" data-go="settings:channels"><h3>🔌 连接</h3><div class="chips">${S.channels.map((c) => `<span class="chip"><span class="dot ${dotCls(c.status.state)}"></span>${CH[c.id].label}</span>`).join("")}</div><div class="sub">${esc(S.model.provider)}/${esc(S.model.modelId)}</div></button>`);
  panels.push(`<button class="panel" data-go="settings:skills"><h3>✨ 技能</h3><div class="big">${sk.length}</div><div class="line muted">${sk.length ? sk.slice(0, 3).map((s) => esc(s.name)).join(" · ") : "Tomo 会把反复做的事沉淀成技能"}</div></button>`);
  $("panels").innerHTML = panels.join("");
  $("panels").querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => {
    const [where, page] = b.dataset.go.split(":");
    if (where === "settings") openSettings(page);
    else go(where);
  }));
}

// ---------- Projects ----------
async function renderProjects() {
  const ps = await api("/api/projects");
  $("projectList").innerHTML = ps.length
    ? ps.map((p) => `<button class="row" data-id="${esc(p.id)}"><span class="grow"><div class="name">${p.status === "active" ? "" : "🗄 "}${esc(p.name)}</div><div class="desc">${esc((p.brief || "还没有简报").split("\n").find((l) => l.trim()) ?? "")}</div></span><span class="muted small">${ago(p.updated_at)}</span></button>`).join("")
    : `<div class="empty">还没有项目。<br/>在对话里说「帮我开个项目：搬家」试试。</div>`;
  $("projectList").querySelectorAll("[data-id]").forEach((b) => (b.onclick = () => openProject(b.dataset.id)));
}
async function openProject(id) {
  const p = await api(`/api/projects/${encodeURIComponent(id)}`);
  sheet(p.name, (body) => {
    body.innerHTML = `<p class="note" style="margin:4px 4px 10px">更新于 ${ago(p.updated_at)} · ${p.status === "active" ? "进行中" : "已归档"}</p><div class="brief">${esc(p.brief || "还没有简报。Tomo 会在工作中自己维护它。")}</div><div class="btns" style="margin-top:14px"><button class="primary" id="useProj">在 Home 对话里切到这个项目</button></div>`;
    $("useProj").onclick = () => {
      closeSheet();
      connect("home");
      go("chat");
      setTimeout(() => ws?.readyState === 1 && ws.send(JSON.stringify({ type: "input", text: `/project ${p.id}` })), 600);
    };
  });
}

// ---------- sheet ----------
const stack = [];
function sheet(title, render, push = false) {
  if (!push) stack.length = 0;
  stack.push({ title, render });
  drawSheet();
}
function drawSheet() {
  const top = stack.at(-1);
  $("scrim").hidden = $("sheet").hidden = false;
  $("sheetTitle").textContent = top.title;
  $("sheetBack").style.visibility = stack.length < 2 ? "hidden" : "visible";
  $("sheetBody").innerHTML = "";
  $("sheetBody").scrollTop = 0;
  top.render($("sheetBody"));
}
function closeSheet() {
  stack.length = 0;
  $("scrim").hidden = $("sheet").hidden = true;
  if (view === "home") renderHome();
}
$("sheetClose").onclick = $("scrim").onclick = closeSheet;
$("sheetBack").onclick = () => { stack.pop(); drawSheet(); };
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("sheet").hidden) closeSheet(); });
const flash = (el, text, ok) => { el.textContent = text; el.className = `msg ${ok ? "ok" : "err"}`; };

// ---------- search ----------
$("searchBtn").onclick = () =>
  sheet("搜索", async (body) => {
    body.innerHTML = `<input class="searchBox" id="q" placeholder="搜索记忆、项目、技能" autofocus /><div id="results"></div>`;
    const [ps, sk] = await Promise.all([api("/api/projects"), api("/api/skills")]);
    let t;
    $("q").oninput = () => { clearTimeout(t); t = setTimeout(run, 200); };
    $("q").focus();
    async function run() {
      const q = $("q").value.trim();
      if (!q) return ($("results").innerHTML = "");
      const mem = await api(`/api/memories?q=${encodeURIComponent(q)}`);
      const lq = q.toLowerCase();
      const pr = ps.filter((p) => (p.name + p.brief).toLowerCase().includes(lq));
      const sr = sk.filter((s) => (s.name + s.description).toLowerCase().includes(lq));
      const sec = (title, items) => (items.length ? `<div class="gtitle">${title}</div><div class="group">${items.join("")}</div>` : "");
      $("results").innerHTML =
        sec("记忆", mem.slice(0, 20).map((m) => `<div class="item"><span class="grow">${esc(m.content)}<div class="muted small">${esc(m.subject)} · ${ago(m.updated_at)}</div></span></div>`)) +
        sec("项目", pr.map((p) => `<button class="item" data-p="${esc(p.id)}"><span class="grow">${esc(p.name)}</span><span class="arrow">›</span></button>`)) +
        sec("技能", sr.map((s) => `<div class="item"><span class="grow">${esc(s.name)}<div class="muted small">${esc(s.description)}</div></span></div>`)) ||
        `<div class="empty">没有找到「${esc(q)}」</div>`;
      $("results").querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => openProject(b.dataset.p)));
    }
  });

// ---------- settings (profile menu) ----------
const CH = {
  telegram: { label: "Telegram", fields: { token: "Bot Token" }, steps: ["Telegram 里找 @BotFather，发送 /newbot", "按提示起名，把它给的 token 填到这里"] },
  discord: { label: "Discord", fields: { token: "Bot Token" }, steps: ["Discord Developer Portal → New Application → Bot → Reset Token", "同一页打开 Message Content Intent", "OAuth2 → URL Generator 勾 bot，用生成的链接把机器人拉进服务器"] },
  slack: { label: "Slack", fields: { botToken: "Bot Token（xoxb-）", appToken: "App Token（xapp-）" }, steps: ["api.slack.com/apps → Create New App", "打开 Socket Mode，生成 App Token，scope 选 connections:write", "OAuth & Permissions 加 Bot scopes：app_mentions:read chat:write im:history im:read im:write", "Event Subscriptions 订阅 app_mention、message.im；App Home 里允许发消息", "Install to Workspace，复制 Bot Token"] },
};
const STATE = { connected: ["已连接", "ok"], connecting: ["连接中", "warn"], error: ["连接失败", "err"], off: ["未连接", ""] };
const dotCls = (s) => STATE[s]?.[1] ?? "";

$("profileBtn").onclick = () => openSettings();
async function openSettings(page) {
  const S = await api("/api/settings");
  const pages = {
    profile: ["资料", renderProfile],
    schedules: ["定时任务", renderSchedules],
    channels: ["已连接账号", renderChannels],
    models: ["AI 模型", renderModels],
    memory: ["记忆", renderMemory],
    skills: ["技能", renderSkills],
    security: ["安全", renderSecurity],
    about: ["关于", renderAbout],
  };
  sheet("设置", (body) => {
    const hasKey = S.providers.some((p) => p.key.set || p.fromEnv);
    const conn = S.channels.filter((c) => c.status.state === "connected").map((c) => CH[c.id].label);
    const item = (k, icon, val) => `<button class="item" data-p="${k}"><span>${icon}</span><span class="grow">${pages[k][0]}</span><span class="val">${val ?? ""}</span><span class="arrow">›</span></button>`;
    body.innerHTML = `
      <div class="group">${item("profile", "👤", S.owners.length ? `${S.owners.length} 个账号` : "未配对")}${item("schedules", "⏰")}</div>
      <div class="group">${item("channels", "🔌", conn.join("、") || "未连接")}${item("models", "🤖", hasKey ? esc(S.model.modelId) : "未设置")}</div>
      <div class="group">${item("memory", "🧠")}${item("skills", "✨")}</div>
      <div class="group">${item("security", "🔒")}${item("about", "ℹ️")}</div>
      <div class="group"><button class="item danger" id="logout">退出登录</button></div>`;
    body.querySelectorAll("[data-p]").forEach((b) => (b.onclick = () => sheet(pages[b.dataset.p][0], pages[b.dataset.p][1], true)));
    $("logout").onclick = async () => { await api("/api/auth/logout", { method: "POST" }); token = localStorage.token = ""; location.reload(); };
  });
  if (page && pages[page]) sheet(pages[page][0], pages[page][1], true);
}
const redraw = () => drawSheet();

async function renderProfile(body) {
  const S = await api("/api/settings");
  const env = new Set(S.ownersFromEnv);
  body.innerHTML = `
    <div class="gtitle">你的账号</div>
    <div class="group">${S.owners.length ? S.owners.map((o) => `<div class="item"><span class="grow"><code>${esc(o)}</code></span>${env.has(o) ? `<span class="badge">环境变量</span>` : `<button class="dangerBtn" data-o="${esc(o)}">移除</button>`}</div>`).join("") : `<div class="item muted">还没有配对的账号</div>`}</div>
    <p class="note">配对后，你在各平台私聊 Tomo 都会进同一个 Home 对话；别人的私聊会被忽略。</p>
    <div class="group"><div class="field"><div class="btns"><button class="primary" id="pair">生成配对码</button></div><div id="pairBox" hidden><div class="code" id="code"></div><p class="note" style="margin:0;text-align:center">10 分钟内，用你的账号私聊机器人发送 <code id="cmd"></code></p></div></div></div>`;
  body.querySelectorAll("[data-o]").forEach((b) => (b.onclick = async () => { await api(`/api/settings/owners/${encodeURIComponent(b.dataset.o)}`, { method: "DELETE" }); redraw(); }));
  $("pair").onclick = async () => {
    const r = await api("/api/settings/pair", { method: "POST" });
    $("pairBox").hidden = false;
    $("code").textContent = r.code;
    $("cmd").textContent = `/pair ${r.code}`;
    const n = S.owners.length;
    const t = setInterval(async () => {
      if ($("sheet").hidden || !$("code")) return clearInterval(t);
      const s = await api("/api/settings");
      if (s.owners.length !== n) { clearInterval(t); toast("配对成功"); redraw(); }
    }, 3000);
    setTimeout(() => clearInterval(t), 600_000);
  };
}

async function renderSchedules(body) {
  const list = await api("/api/schedules");
  body.innerHTML = list.length
    ? `<div class="group">${list.map((s) => `<div class="item"><span class="grow">${esc(s.title)}<div class="muted small">${s.next_run ? esc(when(s.next_run)) : "已结束"} · ${esc({ once: "一次", interval: "间隔", daily: "每天", cron: "cron" }[s.kind] ?? s.kind)} ${esc(s.spec)}</div></span><button class="dangerBtn" data-s="${esc(s.id)}">取消</button></div>`).join("")}</div>`
    : `<div class="empty">没有定时任务。<br/>在对话里说「每个工作日早上 8 点给我发今天的安排」。</div>`;
  body.querySelectorAll("[data-s]").forEach((b) => (b.onclick = async () => { await api(`/api/schedules/${encodeURIComponent(b.dataset.s)}`, { method: "DELETE" }); toast("已取消"); redraw(); }));
}

async function renderChannels(body) {
  const S = await api("/api/settings");
  body.innerHTML = `<p class="note" style="margin:4px 4px 6px">保存后立刻连接，不用重启。</p>` + S.channels.map((c) => {
    const meta = CH[c.id], [st, cls] = STATE[c.status.state] ?? ["", ""];
    return `<div class="group" data-c="${c.id}">
      <div class="item"><span class="grow"><strong>${meta.label}</strong> <span class="badge ${cls}">${st}</span></span><input type="checkbox" class="toggle" ${c.enabled ? "checked" : ""} aria-label="启用" /></div>
      ${Object.entries(meta.fields).map(([f, label]) => {
        const v = c.fields[f] ?? {}, now = v.last4 ? `已保存 ····${esc(v.last4)}` : v.fromEnv ? "来自环境变量" : "";
        return `<div class="field"><label>${label} ${now ? `<span class="badge">${now}</span>` : ""}</label><input type="password" data-f="${f}" autocomplete="off" placeholder="${now ? "留空则不修改" : "粘贴 token"}" /></div>`;
      }).join("")}
      <div class="field"><div class="btns"><button class="primary save">保存并连接</button><span class="msg ${c.status.state === "error" ? "err" : ""}">${c.status.state === "error" ? esc(c.status.error) : ""}</span></div>
      <details><summary class="muted small">怎么拿 token</summary><ol class="steps">${meta.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></details></div>
    </div>`;
  }).join("");
  body.querySelectorAll("[data-c]").forEach((g) => {
    const id = g.dataset.c, btn = g.querySelector(".save"), msg = g.querySelector(".msg"), tg = g.querySelector(".toggle");
    const save = async () => {
      const b = { enabled: tg.checked };
      g.querySelectorAll("[data-f]").forEach((i) => { if (i.value.trim()) b[i.dataset.f] = i.value.trim(); });
      btn.disabled = true;
      flash(msg, "连接中…", true);
      const r = await api(`/api/settings/channels/${id}`, { method: "PUT", body: b });
      if (r.error) { btn.disabled = false; return flash(msg, r.error); }
      if (r.status.state === "connected") toast(`${CH[id].label} 已连接`);
      redraw();
    };
    btn.onclick = save;
    tg.onchange = save;
  });
}

async function renderModels(body) {
  const S = await api("/api/settings");
  const ready = (p) => p.key.set || p.fromEnv;
  const opts = S.providers.map((p) => `<option value="${p.id}">${esc(p.label)}${ready(p) ? "" : "（未设置 key）"}</option>`).join("");
  body.innerHTML = `
    <div class="gtitle">默认模型</div>
    <div class="group">
      <div class="field"><label>主模型 · 对话</label><select id="mp">${opts}</select><select id="mi"></select></div>
      <div class="field"><label>小模型 · 后台反思和子任务</label><select id="sp">${opts}</select><select id="si"></select></div>
      <div class="field"><div class="btns"><button class="primary" id="saveM">保存</button><span class="msg" id="mMsg"></span></div></div>
    </div>
    <div class="gtitle">供应商</div>
    <p class="note" style="margin:8px 4px 0">key 加密保存在你的服务器上，这里只显示末四位。</p>
    ${S.providers.map((p) => `<div class="group" data-p="${p.id}">
      <div class="item"><span class="grow"><strong>${esc(p.label)}</strong> ${p.key.set ? `<span class="badge ok">····${esc(p.key.last4)}</span>` : p.fromEnv ? `<span class="badge">环境变量</span>` : ""}</span>${p.key.set ? `<button class="dangerBtn del">删除</button>` : ""}</div>
      <div class="field"><input type="password" autocomplete="off" placeholder="${p.key.set ? "输入新 key 替换" : "API key"}" /><div class="btns"><button class="primary save">保存</button><button class="ghost test" ${ready(p) ? "" : "disabled"}>测试</button><span class="msg"></span></div><span class="muted small">${esc(p.hint)}</span></div>
    </div>`).join("")}`;
  const fill = async (ps, is, want) => {
    const list = await api(`/api/settings/models?provider=${encodeURIComponent(ps.value)}`);
    is.innerHTML = list.map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join("");
    if (want && list.some((m) => m.id === want)) is.value = want;
  };
  for (const [ps, is, cur] of [[$("mp"), $("mi"), S.model], [$("sp"), $("si"), S.smallModel]]) {
    ps.value = S.providers.some((p) => p.id === cur.provider) ? cur.provider : S.providers[0].id;
    await fill(ps, is, cur.modelId);
    ps.onchange = () => fill(ps, is);
  }
  $("saveM").onclick = async () => {
    const r = await api("/api/settings/model", { method: "PUT", body: { model: { provider: $("mp").value, modelId: $("mi").value }, smallModel: { provider: $("sp").value, modelId: $("si").value } } });
    r.error ? flash($("mMsg"), r.error) : (flash($("mMsg"), "已保存", true), toast(`主模型：${r.model.modelId}`));
  };
  body.querySelectorAll(".group[data-p]").forEach((g) => {
    const id = g.dataset.p, input = g.querySelector("input"), msg = g.querySelector(".msg");
    const test = async () => {
      flash(msg, "测试中…", true);
      const r = await api(`/api/settings/providers/${id}/test`, { method: "POST", body: {} });
      r.ok ? flash(msg, `可以用 ✓ ${r.model}`, true) : flash(msg, r.error ?? "失败");
    };
    g.querySelector(".save").onclick = async () => {
      if (!input.value.trim()) return flash(msg, "先填 key");
      const r = await api(`/api/settings/providers/${id}`, { method: "PUT", body: { key: input.value } });
      if (r.error) return flash(msg, r.error);
      input.value = "";
      input.placeholder = "输入新 key 替换";
      g.querySelector(".test").disabled = false;
      await test();
    };
    g.querySelector(".test").onclick = test;
    g.querySelector(".del")?.addEventListener("click", async () => { if (confirm("删除这个 key？")) { await api(`/api/settings/providers/${id}`, { method: "DELETE" }); redraw(); } });
  });
}

async function renderMemory(body) {
  body.innerHTML = `<input class="searchBox" id="mq" placeholder="搜索记忆" /><div id="ml"></div>`;
  const load = async () => {
    const q = $("mq").value.trim();
    const list = await api(q ? `/api/memories?q=${encodeURIComponent(q)}` : "/api/memories");
    $("ml").innerHTML = list.length
      ? `<div class="group">${list.map((m) => `<div class="item"><span class="grow">${esc(m.content)}<div class="muted small">${esc(m.subject)} · ${m.confidence === "inferred" ? "推断" : "你说的"} · ${ago(m.updated_at)}</div></span><button class="dangerBtn" data-m="${m.id}">忘掉</button></div>`).join("")}</div>`
      : `<div class="empty">${q ? "没有匹配的记忆" : "还没有记忆"}</div>`;
    $("ml").querySelectorAll("[data-m]").forEach((b) => (b.onclick = async () => { await api(`/api/memories/${b.dataset.m}`, { method: "DELETE" }); toast("已忘掉"); load(); }));
  };
  let t;
  $("mq").oninput = () => { clearTimeout(t); t = setTimeout(load, 200); };
  load();
}

async function renderSkills(body) {
  const sk = await api("/api/skills");
  body.innerHTML = sk.length
    ? `<div class="group">${sk.map((s) => `<div class="item"><span class="grow"><strong>${esc(s.name)}</strong><div class="muted small">${esc(s.description)}</div></span></div>`).join("")}</div><p class="note">技能由 Tomo 在工作中自己写和改进。</p>`
    : `<div class="empty">还没有技能。<br/>Tomo 会把反复做的事沉淀成技能。</div>`;
}

function renderSecurity(body) {
  body.innerHTML = `<div class="group">
    <div class="field"><label>当前密码</label><input type="password" id="cur" autocomplete="current-password" /></div>
    <div class="field"><label>新密码（至少 8 位）</label><input type="password" id="nxt" autocomplete="new-password" /></div>
    <div class="field"><div class="btns"><button class="primary" id="chg">修改密码</button><span class="msg" id="pMsg"></span></div></div></div>
    <p class="note">修改后，其他设备需要重新登录。</p>`;
  $("chg").onclick = async () => {
    const r = await api("/api/settings/password", { method: "PUT", body: { current: $("cur").value, next: $("nxt").value } });
    if (r.token) { token = localStorage.token = r.token; flash($("pMsg"), "已修改", true); $("cur").value = $("nxt").value = ""; }
    else flash($("pMsg"), r.error === "wrong password" ? "当前密码不对" : r.error);
  };
}

function renderAbout(body) {
  body.innerHTML = `<div class="group">
    <div class="item"><span class="grow">Tomo</span><span class="val">个人 agent · Pi Durable + Bun</span></div>
    <a class="item" href="https://github.com/QinYangWang/tomo" target="_blank" rel="noopener" style="color:inherit;text-decoration:none"><span class="grow">源代码</span><span class="arrow">›</span></a></div>
    <p class="note">数据全部在你自己的服务器上：data/ 目录。备份时连同 secret.key 一起。</p>`;
}

// ---------- boot ----------
async function boot(firstRun) {
  $("gate").hidden = true;
  convs = await api("/api/conversations");
  connect("home");
  const S = await api("/api/settings");
  const hasKey = S.providers.some((p) => p.key.set || p.fromEnv);
  if (firstRun || !hasKey) {
    go("home");
    if (firstRun) openSettings("models");
  } else go("chat");
}
gate();
