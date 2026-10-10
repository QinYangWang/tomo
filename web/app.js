// Tomo web client. No build step: plain DOM. Icons come from icons.js (Hugeicons).
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
let token = localStorage.token || "";
const desk = matchMedia("(min-width: 641px)");

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
  return days === 0 ? `今天 ${t}` : days === 1 ? `明天 ${t}` : days === -1 ? `昨天 ${t}` : `${d.getMonth() + 1}月${d.getDate()}日 ${t}`;
};
const CADENCE = { none: "不自动刷新", hourly: "每小时刷新", daily: "每天刷新", weekly: "每周刷新" };

// static icons
$("dock").querySelector('[data-view="home"]').innerHTML = ic("home");
$("dock").querySelector('[data-view="chat"]').innerHTML = ic("chat");
$("dock").querySelector('[data-view="projects"]').innerHTML = ic("projects");
$("setBtn").innerHTML = ic("settings");
$("sendBtn").innerHTML = ic("send");
$("sheetBack").innerHTML = ic("back");
$("sheetClose").innerHTML = ic("close");
$("projAdd").innerHTML = ic("add", 18);
document.querySelector(".chev").innerHTML = ic("right", 14);
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

// ---------- navigation: dock + the context button beside it ----------
let view = "home";
const CTX = {
  home: { icon: "add", tip: "新建面板", run: () => newPanel() },
  chat: { icon: "search", tip: "搜索聊天记录", run: () => searchHistory() },
  projects: { icon: "sidebar", tip: "项目列表", run: () => toggleDrawer() },
};
function go(v) {
  view = v;
  localStorage.view = v;
  for (const s of document.querySelectorAll(".view")) s.classList.toggle("on", s.id === `v-${v}`);
  for (const b of $("dock").querySelectorAll("button")) b.classList.toggle("on", b.dataset.view === v);
  $("ctxBtn").innerHTML = ic(CTX[v].icon);
  $("ctxBtn").dataset.tip = CTX[v].tip;
  $("ctxBtn").setAttribute("aria-label", CTX[v].tip);
  if (v !== "projects") toggleDrawer(false, false);
  if (v === "home") renderHome();
  if (v === "projects") renderProjects();
  if (v === "chat") {
    $("v-chat").append($("chatPane"));
    if (current !== chatConv) connect(chatConv);
    setTimeout(() => ($("thread").scrollTop = 1e9));
  }
}
for (const b of $("dock").querySelectorAll("button")) b.onclick = () => go(b.dataset.view);
$("ctxBtn").onclick = () => CTX[view].run();
$("setBtn").onclick = () => openSettings();

// ---------- chat ----------
let current = "", chatConv = "home", ws, live = null, work = null, typing = null, convs = [];
const textOf = (msgs) => (msgs ?? []).flatMap((m) => (typeof m.content === "string" ? [m.content] : (m.content ?? []).filter((c) => c.type === "text").map((c) => c.text))).join("");
const TOOL_NAMES = {
  remember: "记下一件事", recall: "翻记忆", forget: "删除记忆", update_memory: "更新记忆",
  project_create: "新建项目", project_brief: "更新项目简报", project_switch: "切换项目", project_list: "看项目列表",
  skill_save: "保存技能", skill_edit: "改进技能", skill_read: "读技能",
  schedule_create: "设定定时任务", schedule_cancel: "取消定时任务", schedule_list: "看定时任务",
  panel_publish: "更新 Home 面板", panel_list: "看面板", panel_remove: "移除面板",
  subagent: "派出子任务", search_history: "翻聊天记录", fetch_url: "打开网页", handoff: "转交",
  bash: "运行命令", read: "读文件", write: "写文件", edit: "改文件",
};
const toolLabel = (name, args) => {
  const base = TOOL_NAMES[name] ?? name;
  const hint = args?.url ?? args?.query ?? args?.title ?? args?.name ?? args?.command ?? args?.path ?? "";
  return hint ? `${base} · ${String(hint).slice(0, 60)}` : base;
};
function add(el) {
  $("log").append(el);
  if (typing) $("log").append(typing);
  $("thread").scrollTop = 1e9;
  return el;
}
function bubble(cls, text, entryId) {
  const d = document.createElement("div");
  d.className = `b ${cls}`;
  if (entryId) d.dataset.entry = entryId;
  if (cls === "ai") d.innerHTML = md(text);
  else d.textContent = text;
  return add(d);
}
function workCard() {
  if (work) return work;
  const d = document.createElement("details");
  d.className = "work";
  d.innerHTML = `<summary><span class="spin">${ic("loading", 16)}</span><span class="label">正在处理</span></summary><ol></ol>`;
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
  w.querySelector(".label").textContent = `正在处理 · ${label}`;
}
function finishWork() {
  if (!work) return;
  work.classList.add("done");
  work.querySelector(".spin").innerHTML = ic("check", 16);
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
    bubble("me", textOf(e.model), String(e.id));
  } else if (e.kind === "pi.assistant") {
    for (const m of e.model ?? []) for (const c of m.content ?? []) if (c.type === "toolCall" && fromSnapshot) step(toolLabel(c.name, c.arguments));
    const t = textOf(e.model);
    if (t) {
      finishWork();
      bubble("ai", t, String(e.id));
    }
  }
}
function convLabel(id) {
  const c = convs.find((x) => x.id === id || (id === "home" && x.key === "home"));
  return c && c.key !== "home" ? c.key : "Home";
}
function connect(id, kind = "chat") {
  ws?.close();
  $("log").innerHTML = "";
  live = work = typing = null;
  current = id;
  if (kind === "chat") $("convName").textContent = convLabel(id);
  $("t").placeholder = kind === "project" ? "在这个项目里给 Tomo 发消息" : "给 Tomo 发消息";
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const sock = (ws = new WebSocket(`${proto}://${location.host}/ws?conversation=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`));
  sock.onmessage = (ev) => {
    for (const e of JSON.parse(ev.data)) {
      if (e.type === "snapshot") {
        $("log").innerHTML = "";
        work = typing = null;
        e.entries.forEach((x) => renderEntry(x, true));
        finishWork();
        if (!e.entries.length) $("log").innerHTML = kind === "project"
          ? `<div class="projStart"><b>新项目，从零开始</b>这里是这个项目自己的对话和记忆，和日常聊天互不相通。<br/>先告诉 Tomo 这个项目要做什么。</div>`
          : `<div class="empty">这是你和 Tomo 的 Home 对话。<br/>在 Telegram、Discord、Slack 私聊它，也会出现在这里。</div>`;
      } else if (e.type === "run_start") setTyping(true);
      else if (e.type === "message_start" && e.message?.role === "assistant") live = null;
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
          if (live) { live.innerHTML = md(t); live.dataset.entry = String(e.entry.id); }
          else if (t) { setTyping(false); finishWork(); bubble("ai", t, String(e.entry.id)); }
        }
        live = null;
      } else if (e.type === "tool_execution_start") { setTyping(false); step(toolLabel(e.toolName, e.args)); setTyping(true); }
      else if (e.type === "auto_retry_start") toast(`模型出错，正在重试：${String(e.errorMessage).slice(0, 80)}`);
      else if (e.type === "run_end") { setTyping(false); finishWork(); }
    }
  };
  sock.onclose = (ev) => {
    if (ev.code === 4401) return gate();
    setTimeout(() => ws === sock && connect(id, kind), 2000);
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
$("t").addEventListener("input", () => { $("t").style.height = ""; $("t").style.height = Math.min($("t").scrollHeight, 200) + "px"; });
$("t").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing && matchMedia("(pointer:fine)").matches) { e.preventDefault(); $("composer").requestSubmit(); } };
$("convPick").onclick = async () => {
  convs = await api("/api/conversations");
  sheet("切换对话", (body) => {
    body.innerHTML = `<div class="group">${convs.map((c) => {
      const id = c.key === "home" ? "home" : c.id;
      return `<button class="item" data-id="${esc(id)}">${ic(c.key === "home" ? "home" : "chat", 18)}<span class="grow">${c.key === "home" ? "Home <span class='muted small'>· 所有平台的私聊</span>" : esc(c.key)}</span>${id === current ? ic("tick", 18) : ""}</button>`;
    }).join("")}</div><p class="note">群聊和频道各有自己的对话，线程从频道对话分叉。</p>`;
    body.querySelectorAll("[data-id]").forEach((b) => (b.onclick = () => { closeSheet(); chatConv = b.dataset.id; connect(chatConv); go("chat"); }));
  }, { small: true });
};

// chat context button: search this conversation's whole history
function searchHistory() {
  sheet(`搜索 · ${view === "projects" && openProject ? openProject.name : convLabel(current)}`, (body) => {
    body.innerHTML = `<input class="searchBox" id="hq" placeholder="搜索聊天记录" /><div id="hres"></div>`;
    let t;
    $("hq").oninput = () => { clearTimeout(t); t = setTimeout(run, 250); };
    $("hq").focus();
    async function run() {
      const q = $("hq").value.trim();
      if (!q) return ($("hres").innerHTML = "");
      const hits = await api(`/api/history?q=${encodeURIComponent(q)}&conversation=${encodeURIComponent(current)}`);
      const plain = (s) => s.replace(/[*_`#>]+/g, "").replace(/\s+/g, " ");
      const mark = (s) => esc(plain(s)).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (m) => `<mark>${m}</mark>`);
      $("hres").innerHTML = hits.length
        ? `<div class="group">${hits.map((h) => `<button class="hit" data-e="${esc(h.entryId)}"><div class="who">${h.role === "user" ? "你" : "Tomo"}${h.at ? ` · ${esc(when(h.at))}` : ""}</div><div>${mark(h.text.length > 220 ? h.text.slice(0, 220) + "…" : h.text)}</div></button>`).join("")}</div>`
        : `<div class="empty">没有找到「${esc(q)}」</div>`;
      $("hres").querySelectorAll("[data-e]").forEach((b) => (b.onclick = () => {
        closeSheet();
        const el = $("log").querySelector(`[data-entry="${CSS.escape(b.dataset.e)}"]`);
        if (!el) return toast("这条在更早的上下文里，已不在当前窗口");
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
      }));
    }
  }, { small: true });
}

// ---------- Home ----------
const TINTS = ["t-mint", "t-marigold", "t-periwinkle", "t-blush"];
let panelPoll;
async function renderHome() {
  const h = new Date().getHours();
  $("hello").textContent = h < 5 ? "夜深了" : h < 11 ? "早上好" : h < 14 ? "中午好" : h < 18 ? "下午好" : "晚上好";
  $("today").textContent = new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });
  const [S, sch, mem, ps] = await Promise.all([api("/api/settings"), api("/api/schedules"), api("/api/memories"), api("/api/panels")]);
  const out = [];
  const hasKey = S.providers.some((p) => p.key.set || p.fromEnv);
  const connected = S.channels.filter((c) => c.status.state === "connected");
  const cta = (go, icon, title, sub) => `<div class="panel full cta click" data-go="${go}"><div class="ph"><span class="tint">${ic(icon, 18)}</span><h3>下一步</h3></div><div class="big">${title}</div><div class="sub">${sub}</div></div>`;
  if (!hasKey) out.push(cta("settings:models", "ai", "接上一个 AI 模型", "填任意一家的 API key，Tomo 就能开始干活"));
  else if (!connected.length) out.push(cta("settings:channels", "plug", "连上一个消息平台", "Telegram、Discord 或 Slack，填 token 就能上线"));
  else if (!S.owners.length) out.push(cta("settings:profile", "user", "配对你的账号", "让机器人认出你，私聊会进 Home 对话"));

  // panels Tomo built
  ps.forEach((p, i) => out.push(panelCard(p, TINTS[i % TINTS.length])));

  // built-in glance cards
  const next = sch[0];
  out.push(`<div class="panel click" data-go="settings:schedules"><div class="ph"><span class="tint t-linen">${ic("clock", 18)}</span><h3>接下来</h3></div>${next ? `<div class="big">${esc(when(next.next_run))}</div><div class="line">${esc(next.title)}</div><div class="pf">共 ${sch.length} 个定时任务</div>` : `<div class="line muted">没有定时任务</div><div class="pf">在对话里说「每天早上 8 点提醒我…」</div>`}</div>`);
  out.push(`<div class="panel click" data-go="settings:memory"><div class="ph"><span class="tint t-linen">${ic("brain", 18)}</span><h3>最近记住的</h3></div>${mem.length ? mem.slice(0, 3).map((m) => `<div class="line">${esc(m.content)}</div>`).join("") + `<div class="pf">共 ${mem.length} 条 · 最近 ${ago(mem[0].updated_at)}</div>` : `<div class="line muted">还没有记忆。聊得越多，Tomo 越懂你。</div>`}</div>`);
  out.push(`<div class="panel click" data-go="settings:channels"><div class="ph"><span class="tint t-linen">${ic("plug", 18)}</span><h3>连接</h3></div><div class="chips">${S.channels.map((c) => `<span class="chip">${ic(c.id, 14)}${CH[c.id].label}<span class="dot ${dotCls(c.status.state)}"></span></span>`).join("")}</div><div class="pf">${ic("ai", 14)}${esc(S.model.modelId)}</div></div>`);
  if (!ps.length) out.push(`<div class="panel click" data-new="1" style="border:1.5px dashed var(--ash);box-shadow:none;background:none"><div class="ph"><span class="tint t-linen">${ic("add", 18)}</span><h3>新建面板</h3></div><div class="line muted">告诉 Tomo 想在这里看到什么：比特币价格、这周的待办、某个网站的更新…</div></div>`);

  $("panels").innerHTML = out.join("");
  $("panels").querySelectorAll("[data-go]").forEach((b) => (b.onclick = (e) => {
    if (e.target.closest("button")) return;
    const [where, page] = b.dataset.go.split(":");
    where === "settings" ? openSettings(page) : go(where);
  }));
  $("panels").querySelector("[data-new]")?.addEventListener("click", newPanel);
  $("panels").querySelectorAll("[data-act]").forEach((b) => (b.onclick = () => panelAction(b.dataset.id, b.dataset.act)));
  clearTimeout(panelPoll);
  if (ps.some((p) => p.status === "building") && view === "home") panelPoll = setTimeout(renderHome, 3000);
}
function panelCard(p, tint) {
  const menu = `<button class="icon sm pmenu" data-act="menu" data-id="${esc(p.id)}" data-tip="更多">${ic("more", 18)}</button>`;
  const head = `<div class="ph"><span class="tint ${tint}">${ic("dashboard", 18)}</span><h3>${esc(p.title)}</h3>${p.status === "building" ? "" : menu}</div>`;
  if (p.status === "building")
    return `<div class="panel">${head}${p.body ? `<div class="pbody" style="opacity:.45">${md(p.body)}</div>` : `<div class="skeleton"><i></i><i></i><i></i></div>`}<div class="pf">${ic("loading", 14)}Tomo 正在${p.body ? "刷新" : "制作"}…</div></div>`;
  if (p.status === "error" && !p.body)
    return `<div class="panel">${head}<div class="line err">没做成：${esc(p.error ?? "")}</div><div class="pf"><button class="ghost" data-act="refresh" data-id="${esc(p.id)}">重试</button></div></div>`;
  return `<div class="panel">${head}<div class="pbody">${md(p.body)}</div><div class="pf">${p.status === "error" ? `<span class="err">刷新失败 · </span>` : ""}更新于 ${ago(p.updated_at)} · ${CADENCE[p.cadence] ?? ""}</div></div>`;
}
async function panelAction(id, act) {
  if (act === "menu") {
    const p = (await api("/api/panels")).find((x) => x.id === id);
    if (!p) return;
    return sheet(p.title, (body) => {
      body.innerHTML = `<p class="note" style="margin:0 4px 6px">${esc(p.request)} · ${CADENCE[p.cadence] ?? ""}</p><div class="group">
        <button class="item" data-a="refresh">${ic("refresh", 20)}<span class="grow">现在刷新</span></button>
        <button class="item" data-a="edit">${ic("edit", 20)}<span class="grow">让 Tomo 修改</span></button>
        <button class="item" data-a="remove" style="color:var(--err)">${ic("trash", 20)}<span class="grow">从 Home 移除</span></button></div>`;
      body.querySelectorAll("[data-a]").forEach((b) => (b.onclick = () => { if (b.dataset.a !== "edit") closeSheet(); panelAction(id, b.dataset.a); }));
    }, { small: true });
  }
  if (act === "remove") {
    if (!confirm("从 Home 移除这个面板？")) return;
    await api(`/api/panels/${id}`, { method: "DELETE" });
  } else if (act === "refresh") {
    await api(`/api/panels/${id}/refresh`, { method: "POST" });
  } else if (act === "edit") {
    return sheet("修改面板", (body) => {
      body.innerHTML = `<textarea class="bigInput" id="pe" placeholder="比如：只显示前 3 条；改成每天早上刷新；加上涨跌幅"></textarea><div class="btns" style="margin-top:12px;justify-content:flex-end"><button class="primary" id="peGo">让 Tomo 修改</button></div>`;
      $("pe").focus();
      $("peGo").onclick = async () => {
        const instruction = $("pe").value.trim();
        if (!instruction) return;
        await api(`/api/panels/${id}`, { method: "PUT", body: { instruction } });
        closeSheet();
        setTimeout(renderHome, 400);
      };
    }, { small: true });
  }
  renderHome();
}
// home context button: ask Tomo for a new panel
function newPanel() {
  sheet("新建面板", (body) => {
    body.innerHTML = `<p class="muted" style="margin:0 2px 12px">想在 Home 上一眼看到什么？Tomo 会去找数据、做成卡片，并按合适的频率自动刷新。</p>
      <textarea class="bigInput" id="np" placeholder="比如：比特币和以太坊的价格"></textarea>
      <div class="examples">${["比特币和以太坊的价格", "东京这周的天气", "我这周的定时任务和待办", "Hacker News 头条前五", "GitHub 上 tomo 仓库的最新提交"].map((x) => `<button>${x}</button>`).join("")}</div>
      <div class="btns" style="margin-top:14px;justify-content:flex-end"><span class="msg" id="npMsg"></span><button class="primary" id="npGo">创建</button></div>`;
    body.querySelectorAll(".examples button").forEach((b) => (b.onclick = () => { $("np").value = b.textContent; $("np").focus(); }));
    $("np").focus();
    $("np").onkeydown = (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) $("npGo").click(); };
    $("npGo").onclick = async () => {
      const request = $("np").value.trim();
      if (!request) return;
      const r = await api("/api/panels", { method: "POST", body: { request } });
      if (r.error) return flash($("npMsg"), r.error);
      closeSheet();
      go("home");
    };
  }, { small: true });
}

// ---------- Projects: each one is its own thread with its own memory ----------
let projectList = [], currentProject = localStorage.project || "", openProject = null;
function toggleDrawer(force, remember = true) {
  const open = force ?? $("drawer").hidden;
  $("drawer").hidden = !open;
  document.body.classList.toggle("drawerOpen", open);
  if (remember) localStorage.drawer = open ? "1" : "";
  if (open) drawDrawer();
}
$("projAdd").onclick = () => newProject();
function drawDrawer() {
  const active = projectList.filter((p) => p.status === "active"), archived = projectList.filter((p) => p.status !== "active");
  const row = (p) => `<button class="dItem ${p.id === currentProject ? "on" : ""}" data-id="${esc(p.id)}">${ic("projects", 18)}<span class="grow">${esc(p.name)}</span><span class="when">${ago(p.updated_at)}</span></button>`;
  $("drawerList").innerHTML = (active.length ? active.map(row).join("") : `<div class="empty">还没有项目</div>`) + (archived.length ? `<div class="gtitle" style="margin:14px 10px 4px">已归档</div>${archived.map(row).join("")}` : "");
  $("drawerList").querySelectorAll("[data-id]").forEach((b) => (b.onclick = () => {
    selectProject(b.dataset.id);
    if (innerWidth < 1100) toggleDrawer(false, false);
  }));
}
function newProject() {
  sheet("新建项目", (body) => {
    body.innerHTML = `<p class="muted" style="margin:0 2px 12px">每个项目是独立的对话，有自己的记忆和工作目录，从零开始。日常聊天只知道有这个项目，不知道里面的内容。</p>
      <input class="searchBox" id="pn" placeholder="项目名称，比如：东京旅行 12 月" />
      <div class="btns" style="margin-top:14px;justify-content:flex-end"><span class="msg" id="pnMsg"></span><button class="primary" id="pnGo">创建</button></div>`;
    $("pn").focus();
    $("pn").onkeydown = (e) => { if (e.key === "Enter" && !e.isComposing) $("pnGo").click(); };
    $("pnGo").onclick = async () => {
      const name = $("pn").value.trim();
      if (!name) return;
      const p = await api("/api/projects", { method: "POST", body: { name } });
      if (p.error) return flash($("pnMsg"), p.error);
      closeSheet();
      currentProject = localStorage.project = p.id;
      if (view !== "projects") go("projects"); else renderProjects();
      setTimeout(() => $("t").focus(), 300);
    };
  }, { small: true });
}
async function renderProjects() {
  projectList = await api("/api/projects");
  if (!projectList.some((p) => p.id === currentProject)) currentProject = projectList.find((p) => p.status === "active")?.id ?? projectList[0]?.id ?? "";
  if (desk.matches && innerWidth >= 1100 && localStorage.drawer !== "") toggleDrawer(true);
  else if (!$("drawer").hidden) drawDrawer();
  if (!currentProject) {
    openProject = null;
    $("projBar").innerHTML = "";
    $("v-chat").append($("chatPane"));
    $("projSlot").innerHTML = `<div class="projEmpty"><p class="eyebrow">项目</p><h2 class="serif">还没有项目</h2><p class="muted">项目适合要花好几天的事：一次旅行、一次搬家、一个产品发布。每个项目都是独立的对话，有自己的记忆。</p><div class="btns" style="justify-content:center"><button class="primary" id="np0">新建项目</button></div></div>`;
    $("np0").onclick = newProject;
    return;
  }
  selectProject(currentProject);
}
async function selectProject(id) {
  currentProject = localStorage.project = id;
  if (!$("drawer").hidden) drawDrawer();
  const p = (openProject = await api(`/api/projects/${encodeURIComponent(id)}`));
  $("projBar").innerHTML = `<div style="flex:1;min-width:0"><p class="eyebrow">${p.status === "active" ? "项目" : "已归档项目"} · 独立记忆</p><h1 class="serif">${esc(p.name)}</h1></div>
    <button class="icon" id="pBrief" data-tip="简报与记忆">${ic("info", 20)}</button>
    <button class="icon" id="pMore" data-tip="更多">${ic("more", 20)}</button>`;
  $("projSlot").querySelector(".projEmpty")?.remove();
  $("projSlot").append($("chatPane"));
  if (current !== p.conversation_id) connect(p.conversation_id, "project");
  $("pBrief").onclick = () => projectInfo(p);
  $("pMore").onclick = () => sheet(p.name, (body) => {
    body.innerHTML = `<div class="group"><button class="item" id="pArch">${ic(p.status === "active" ? "check" : "refresh", 20)}<span class="grow">${p.status === "active" ? "归档这个项目" : "恢复为进行中"}</span></button></div>`;
    $("pArch").onclick = async () => {
      await api(`/api/projects/${encodeURIComponent(p.id)}`, { method: "PATCH", body: { status: p.status === "active" ? "archived" : "active" } });
      closeSheet();
    };
  }, { small: true });
}
async function projectInfo(p) {
  const mem = await api(`/api/memories?scope=${encodeURIComponent(p.id)}`);
  sheet(p.name, (body) => {
    body.innerHTML = `<div class="gtitle">简报</div><div class="doc" style="margin-top:10px">${p.brief ? md(p.brief) : `<p class="muted">还没有简报。Tomo 弄清这个项目的目标后会自己写，并随工作更新。</p>`}</div>
      <div class="gtitle">项目记忆 · ${mem.length} 条</div>${mem.length ? `<div class="group">${mem.map((m) => `<div class="item"><span class="grow">${esc(m.content)}<div class="muted small">${esc(m.subject)} · ${ago(m.updated_at)}</div></span></div>`).join("")}</div>` : `<p class="note" style="margin-top:14px">这个项目还没有记忆。它和日常聊天的记忆是分开的。</p>`}`;
  }, { small: true });
}

// ---------- sheet (modal on desktop, bottom sheet on phones) ----------
const stack = [];
let redrawFn = null;
function sheet(title, render, opts = {}) {
  if (!opts.push) stack.length = 0;
  stack.push({ title, render, opts: opts.push ? stack.at(-1)?.opts ?? opts : opts });
  redrawFn = null;
  drawSheet();
}
function drawSheet() {
  const top = stack.at(-1);
  $("scrim").hidden = $("sheet").hidden = false;
  $("sheet").classList.toggle("small", !!top.opts.small);
  $("sheet").classList.toggle("split", !!top.opts.split);
  $("sheetTitle").textContent = top.title;
  $("sheetBack").style.visibility = stack.length < 2 ? "hidden" : "visible";
  $("sheetBody").innerHTML = "";
  $("sheetBody").scrollTop = 0;
  top.render($("sheetBody"));
}
function closeSheet() {
  stack.length = 0;
  redrawFn = null;
  $("scrim").hidden = $("sheet").hidden = true;
  if (view === "home") renderHome();
  if (view === "projects") renderProjects();
}
$("sheetClose").onclick = $("scrim").onclick = closeSheet;
$("sheetBack").onclick = () => { stack.pop(); drawSheet(); };
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("sheet").hidden) closeSheet();
  if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); go("chat"); searchHistory(); }
});
const flash = (el, text, ok) => { el.textContent = text; el.className = `msg ${ok ? "ok" : "err"}`; };
const redraw = () => (redrawFn ? redrawFn() : drawSheet());

// ---------- settings ----------
const CH = {
  telegram: { label: "Telegram", fields: { token: "Bot Token" }, steps: ["Telegram 里找 @BotFather，发送 /newbot", "按提示起名，把它给的 token 填到这里"] },
  discord: { label: "Discord", fields: { token: "Bot Token" }, steps: ["Discord Developer Portal → New Application → Bot → Reset Token", "同一页打开 Message Content Intent", "OAuth2 → URL Generator 勾 bot，用生成的链接把机器人拉进服务器"] },
  slack: { label: "Slack", fields: { botToken: "Bot Token（xoxb-）", appToken: "App Token（xapp-）" }, steps: ["api.slack.com/apps → Create New App", "打开 Socket Mode，生成 App Token，scope 选 connections:write", "OAuth & Permissions 加 Bot scopes：app_mentions:read chat:write im:history im:read im:write", "Event Subscriptions 订阅 app_mention、message.im；App Home 里允许发消息", "Install to Workspace，复制 Bot Token"] },
};
const STATE = { connected: ["已连接", "ok"], connecting: ["连接中", "warn"], error: ["连接失败", "err"], off: ["未连接", ""] };
const dotCls = (s) => STATE[s]?.[1] ?? "";
const PAGES = {
  profile: ["资料", "user", () => renderProfile],
  schedules: ["定时任务", "clock", () => renderSchedules],
  channels: ["已连接账号", "plug", () => renderChannels],
  models: ["AI 模型", "ai", () => renderModels],
  memory: ["记忆", "brain", () => renderMemory],
  skills: ["技能", "skill", () => renderSkills],
  security: ["安全", "lock", () => renderSecurity],
  about: ["关于", "info", () => renderAbout],
};
const GROUPS = [["profile", "schedules"], ["channels", "models"], ["memory", "skills"], ["security", "about"]];
async function logout() { await api("/api/auth/logout", { method: "POST" }); token = localStorage.token = ""; location.reload(); }

async function openSettings(page) {
  const S = await api("/api/settings");
  const hasKey = S.providers.some((p) => p.key.set || p.fromEnv);
  const conn = S.channels.filter((c) => c.status.state === "connected").map((c) => CH[c.id].label);
  const vals = { profile: S.owners.length ? `${S.owners.length} 个账号` : "未配对", channels: conn.join("、") || "未连接", models: hasKey ? esc(S.model.modelId) : "未设置" };

  if (desk.matches) {
    page ??= !hasKey ? "models" : !conn.length ? "channels" : "profile";
    return sheet("设置", (body) => {
      body.innerHTML = `<nav class="setNav">${GROUPS.map((g) => g.map((k) => `<button class="dItem" data-k="${k}">${ic(PAGES[k][1], 18)}<span class="grow">${PAGES[k][0]}</span></button>`).join("")).join('<div class="sep"></div>')}<div class="sep"></div><button class="dItem" id="logoutD" style="color:var(--err)">${ic("logout", 18)}<span class="grow">退出登录</span></button></nav><div class="setPane" id="setPane"></div>`;
      const show = (k) => {
        page = k;
        body.querySelectorAll("[data-k]").forEach((b) => b.classList.toggle("on", b.dataset.k === k));
        const pane = $("setPane");
        pane.innerHTML = `<h3 class="serif">${PAGES[k][0]}</h3><div></div>`;
        pane.scrollTop = 0;
        PAGES[k][2]()(pane.lastElementChild);
      };
      body.querySelectorAll("[data-k]").forEach((b) => (b.onclick = () => show(b.dataset.k)));
      $("logoutD").onclick = logout;
      show(page);
      redrawFn = () => show(page);
    }, { split: true });
  }
  sheet("设置", (body) => {
    body.innerHTML = GROUPS.map((g) => `<div class="group">${g.map((k) => `<button class="item" data-k="${k}">${ic(PAGES[k][1], 20)}<span class="grow">${PAGES[k][0]}</span><span class="val">${vals[k] ?? ""}</span><span class="arrow">${ic("right", 16)}</span></button>`).join("")}</div>`).join("") + `<div class="group"><button class="item danger" id="logout">退出登录</button></div>`;
    body.querySelectorAll("[data-k]").forEach((b) => (b.onclick = () => sheet(PAGES[b.dataset.k][0], PAGES[b.dataset.k][2](), { push: true })));
    $("logout").onclick = logout;
  });
  if (page && PAGES[page]) sheet(PAGES[page][0], PAGES[page][2](), { push: true });
}

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
      <div class="item">${ic(c.id, 20)}<span class="grow"><strong>${meta.label}</strong> <span class="badge ${cls}">${st}</span></span><input type="checkbox" class="toggle" ${c.enabled ? "checked" : ""} aria-label="启用" /></div>
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
      <div class="field"><label>主模型 · 对话</label><div class="row2"><select id="mp">${opts}</select><select id="mi"></select></div></div>
      <div class="field"><label>小模型 · 后台反思、子任务和面板刷新</label><div class="row2"><select id="sp">${opts}</select><select id="si"></select></div></div>
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
    <div class="item">${ic("sparkles", 20)}<span class="grow">Tomo</span><span class="val">个人 agent · Pi Durable + Bun</span></div>
    <a class="item" href="https://github.com/QinYangWang/tomo" target="_blank" rel="noopener" style="color:inherit;text-decoration:none"><span class="grow">源代码</span><span class="arrow">${ic("right", 16)}</span></a></div>
    <p class="note">数据全部在你自己的服务器上：data/ 目录。备份时连同 secret.key 一起。</p>`;
}



// ---------- boot ----------
async function boot(firstRun) {
  $("gate").hidden = true;
  convs = await api("/api/conversations");
  const S = await api("/api/settings");
  const hasKey = S.providers.some((p) => p.key.set || p.fromEnv);
  go(firstRun || !hasKey ? "home" : localStorage.view && CTX[localStorage.view] ? localStorage.view : "home");
  if (firstRun) openSettings("models");
}
gate();
