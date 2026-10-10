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
for (const [v, name] of [["home", "home"], ["chat", "chat"], ["projects", "projects"]]) $("dock").querySelector(`[data-view="${v}"]`).insertAdjacentHTML("afterbegin", ic(name));

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

// ---------- navigation: dock + the context button at the top-left ----------
let view = "home";
const CTX = {
  home: { icon: "add", tip: "新建面板", run: () => newPanel() },
  chat: { icon: "search", tip: "搜索聊天记录", run: () => searchHistory() },
  projects: { icon: "sidebar", tip: "项目列表", run: () => toggleDrawer() },
  settings: { icon: "back", tip: "返回", run: () => setBack() },
};
const VIEWS = ["home", "chat", "projects"];
function go(v) {
  view = v;
  if (VIEWS.includes(v)) localStorage.view = v;
  $("setBtn").classList.toggle("on", v === "settings");
  if (v === "settings") renderSettings();
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
$("setBtn").onclick = () => (view === "settings" ? go(setFrom) : openSettings());

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
  $("log").querySelector(".empty, .projStart")?.remove();
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
  if (kind === "chat") { $("convName").textContent = convLabel(id); syncConvPick(); }
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
          ? `<div class="projStart"><b>我们要做些什么？</b></div>`
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
  if (view === "projects") watchTitle();
  $("t").value = "";
  $("t").style.height = "";
};
$("t").addEventListener("input", () => { $("t").style.height = ""; $("t").style.height = Math.min($("t").scrollHeight, 200) + "px"; });
$("t").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing && matchMedia("(pointer:fine)").matches) { e.preventDefault(); $("composer").requestSubmit(); } };
// The picker only reads as a menu when there is more than one conversation to pick.
function syncConvPick() { $("convPick").classList.toggle("single", convs.length <= 1); }
$("convPick").onclick = async () => {
  convs = await api("/api/conversations");
  syncConvPick();
  if (convs.length <= 1) return;
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
  const who = S.profile?.nickname || S.profile?.name;
  if (who) $("hello").textContent += `，${who}`;

  // panels Tomo built
  ps.forEach((p, i) => out.push(panelCard(p, TINTS[i % TINTS.length])));

  // built-in glance cards
  const next = sch[0];
  out.push(`<div class="panel click" data-go="settings:schedules"><div class="ph"><span class="tint t-linen">${ic("clock", 18)}</span><h3>接下来</h3></div>${next ? `<div class="big">${esc(when(next.next_run))}</div><div class="line">${esc(next.title)}</div><div class="pf">共 ${sch.length} 个定时任务</div>` : `<div class="line muted">没有定时任务</div><div class="pf">在对话里说「每天早上 8 点提醒我…」</div>`}</div>`);
  out.push(`<div class="panel click" data-go="settings:memory"><div class="ph"><span class="tint t-linen">${ic("brain", 18)}</span><h3>最近记住的</h3></div>${mem.length ? mem.slice(0, 3).map((m) => `<div class="line">${esc(m.content)}</div>`).join("") + `<div class="pf">共 ${mem.length} 条 · 最近 ${ago(mem[0].updated_at)}</div>` : `<div class="line muted">还没有记忆。聊得越多，Tomo 越懂你。</div>`}</div>`);
  out.push(`<div class="panel click" data-go="settings:accounts"><div class="ph"><span class="tint t-linen">${ic("plug", 18)}</span><h3>连接</h3></div><div class="chips">${S.channels.map((c) => `<span class="chip">${ic(c.id, 14)}${CH[c.id].label}<span class="dot ${c.enabled ? dotCls(c.status.state) : ""}"></span></span>`).join("")}</div><div class="pf">${ic("ai", 14)}${esc(S.model.modelId)}</div></div>`);
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
// On phones the drawer is an overlay: a tap anywhere outside it closes it.
document.addEventListener("click", (e) => {
  if ($("drawer").hidden || innerWidth >= 1100 || e.target.closest("#drawer, #ctxBtn, .pop")) return;
  toggleDrawer(false, false);
});
const UNTITLED = "Untitled project";
const pname = (p) => (p.name === UNTITLED ? "未命名项目" : p.name);
function drawDrawer() {
  const active = projectList.filter((p) => p.status === "active"), archived = projectList.filter((p) => p.status !== "active");
  const row = (p) => `<div class="dItem pRow ${p.id === currentProject ? "on" : ""}" data-id="${esc(p.id)}">${ic("projects", 18)}<span class="grow pName">${esc(pname(p))}</span><span class="when">${ago(p.updated_at)}</span><button class="icon sm pMenuBtn" data-menu="${esc(p.id)}" data-tip="更多">${ic("more", 16)}</button></div>`;
  $("drawerList").innerHTML = (active.length ? active.map(row).join("") : `<div class="empty">还没有项目</div>`) + (archived.length ? `<div class="gtitle" style="margin:14px 10px 4px">已归档</div>${archived.map(row).join("")}` : "");
  $("drawerList").querySelectorAll(".pRow").forEach((b) => (b.onclick = (e) => {
    if (e.target.closest("button, input")) return;
    selectProject(b.dataset.id);
    if (innerWidth < 1100) toggleDrawer(false, false);
  }));
  $("drawerList").querySelectorAll("[data-menu]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); projectMenu(b.dataset.menu, b); }));
}
// New project: no dialog, just a fresh thread named "Untitled project" until its first message.
async function newProject() {
  const p = await api("/api/projects", { method: "POST", body: {} });
  if (p.error) return;
  currentProject = localStorage.project = p.id;
  if (view !== "projects") go("projects"); else await renderProjects();
  setTimeout(() => $("t").focus(), 200);
}
// Popover menu for one project: rename (inline), archive/restore, delete (confirm in place).
function projectMenu(id, anchor) {
  closePop();
  const p = projectList.find((x) => x.id === id) ?? openProject;
  if (!p) return;
  const pop = document.createElement("div");
  pop.className = "pop";
  pop.innerHTML = `<button data-a="rename">${ic("edit", 16)}重命名</button>
    <button data-a="archive">${ic(p.status === "active" ? "archive" : "refresh", 16)}${p.status === "active" ? "归档" : "恢复"}</button>
    <button data-a="delete" class="danger">${ic("trash", 16)}<span>删除</span></button>`;
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.top = `${Math.min(r.bottom + 6, innerHeight - pop.offsetHeight - 8)}px`;
  pop.style.left = `${Math.max(8, Math.min(r.right - pop.offsetWidth, innerWidth - pop.offsetWidth - 8))}px`;
  setTimeout(() => document.addEventListener("click", closePop, { once: true }));
  pop.onclick = async (e) => {
    const a = e.target.closest("button")?.dataset.a;
    if (!a) return;
    e.stopPropagation();
    if (a === "rename") { closePop(); return renameInline(p); }
    if (a === "archive") {
      closePop();
      await api(`/api/projects/${encodeURIComponent(p.id)}`, { method: "PATCH", body: { status: p.status === "active" ? "archived" : "active" } });
      return renderProjects();
    }
    if (a === "delete") {
      closePop();
      const ok = await alertDialog({
        title: `删除「${pname(p)}」？`,
        body: "这个项目的对话、记忆和文件都会被删除，无法恢复。",
        confirm: "删除",
        danger: true,
      });
      if (!ok) return;
      await api(`/api/projects/${encodeURIComponent(p.id)}`, { method: "DELETE" });
      if (currentProject === p.id) currentProject = localStorage.project = "";
      return renderProjects();
    }
  };
}
// Alert dialog: a blocking confirm for destructive actions. Resolves true on confirm.
function alertDialog({ title, body, confirm = "确定", cancel = "取消", danger = false }) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "alertWrap";
    wrap.innerHTML = `<div class="alertDlg" role="alertdialog" aria-modal="true" aria-labelledby="adT" aria-describedby="adB">
      <h3 id="adT" class="serif">${esc(title)}</h3><p id="adB">${esc(body)}</p>
      <div class="alertBtns"><button class="ghost" data-r="0">${esc(cancel)}</button><button class="primary ${danger ? "danger" : ""}" data-r="1">${esc(confirm)}</button></div></div>`;
    document.body.append(wrap);
    const close = (v) => { wrap.remove(); document.removeEventListener("keydown", key); resolve(v); };
    const key = (e) => { if (e.key === "Escape") close(false); };
    document.addEventListener("keydown", key);
    wrap.onclick = (e) => {
      const b = e.target.closest("[data-r]");
      if (b) close(b.dataset.r === "1");
    };
    wrap.querySelector('[data-r="0"]').focus();
  });
}
function closePop() { document.querySelectorAll(".pop").forEach((x) => x.remove()); }
function renameInline(p) {
  const done = async (name) => {
    if (name && name !== p.name) await api(`/api/projects/${encodeURIComponent(p.id)}`, { method: "PATCH", body: { name } });
    renderProjects();
  };
  const host = (!$("drawer").hidden && $("drawerList").querySelector(`[data-id="${CSS.escape(p.id)}"] .pName`)) || (p.id === currentProject && $("projBar").querySelector("h1"));
  if (!host) return;
  const input = document.createElement("input");
  input.className = "renameBox";
  input.value = p.name === UNTITLED ? "" : p.name;
  input.placeholder = "项目名称";
  host.replaceChildren(input);
  input.focus();
  input.select();
  let settled = false;
  const finish = (save) => { if (settled) return; settled = true; done(save ? input.value.trim() : ""); };
  input.onkeydown = (e) => {
    if (e.key === "Enter" && !e.isComposing) finish(true);
    if (e.key === "Escape") finish(false);
  };
  input.onblur = () => finish(true);
}
// The project agent names an untitled project on its first turn: watch for the new name.
function watchTitle() {
  if (!openProject || openProject.name !== UNTITLED) return;
  const id = openProject.id;
  [3, 8, 15, 30, 60].forEach((sec) => setTimeout(async () => {
    if (!openProject || openProject.id !== id || openProject.name !== UNTITLED) return;
    const p = await api(`/api/projects/${encodeURIComponent(id)}`);
    if (p.name !== UNTITLED) { openProject = p; $("projBar").querySelector("h1").textContent = p.name; projectList = await api("/api/projects"); if (!$("drawer").hidden) drawDrawer(); }
  }, sec * 1000));
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
    $("projSlot").innerHTML = `<div class="projEmpty"><p class="eyebrow">项目</p><h2 class="serif">还没有项目</h2><p class="muted">项目适合要花好几天的事：一次旅行、一次搬家、一个产品发布。每个项目都是独立的对话，有自己的记忆。</p><div class="btns" style="justify-content:center"><button class="primary" id="np0">开始一个项目</button></div></div>`;
    $("np0").onclick = newProject;
    return;
  }
  selectProject(currentProject);
}
async function selectProject(id) {
  currentProject = localStorage.project = id;
  if (!$("drawer").hidden) drawDrawer();
  const p = (openProject = await api(`/api/projects/${encodeURIComponent(id)}`));
  const line = briefLine(p.brief);
  $("projBar").innerHTML = `<div class="pTitle"><h1 class="serif">${esc(pname(p))}</h1>${line ? `<button class="briefLine" id="pLine"><span>${esc(line)}</span>${ic("right", 14)}</button>` : ""}</div>
    <button class="icon" id="pSearch" data-tip="搜索这个项目" aria-label="搜索">${ic("search", 20)}</button>
    <button class="icon" id="pBrief" data-tip="简报与记忆" aria-label="简报与记忆">${ic("info", 20)}</button>
    <button class="icon" id="pMore" data-tip="更多" aria-label="更多">${ic("more", 20)}</button>`;
  $("pSearch").onclick = () => searchHistory();
  if ($("pLine")) $("pLine").onclick = () => projectInfo(p);
  $("projSlot").querySelector(".projEmpty")?.remove();
  $("projSlot").append($("chatPane"));
  if (current !== p.conversation_id) connect(p.conversation_id, "project");
  $("pBrief").onclick = () => projectInfo(p);
  $("pMore").onclick = (e) => { e.stopPropagation(); projectMenu(p.id, e.currentTarget); };
}
// First line of real content in the brief, shown under the project title.
function briefLine(brief) {
  for (const l of String(brief ?? "").split("\n")) {
    const t = l.replace(/^\s*(#+|[-*•]|\d+[.)]|\[[ x]\])\s*/i, "").replace(/[*_`]/g, "").trim();
    if (t && !/^#/.test(l.trim())) return t;
  }
  return "";
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
  else if (e.key === "Escape" && view === "settings" && !e.target.closest?.("input, textarea")) setBack();
  if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); go("chat"); searchHistory(); }
});
const flash = (el, text, ok) => { el.textContent = text; el.className = `msg ${ok ? "ok" : "err"}`; };
const redraw = () => (redrawFn ? redrawFn() : drawSheet());

// ---------- settings: a page of its own (root list → sub-pages, back on the top-left button) ----------
const CH = {
  telegram: { label: "Telegram", fields: { token: "Bot Token" }, steps: ["Telegram 里找 @BotFather，发送 /newbot", "按提示起名，把它给的 token 填到这里"] },
  discord: { label: "Discord", fields: { token: "Bot Token" }, steps: ["Discord Developer Portal → New Application → Bot → Reset Token", "同一页打开 Message Content Intent", "OAuth2 → URL Generator 勾 bot，用生成的链接把机器人拉进服务器"] },
  slack: { label: "Slack", fields: { botToken: "Bot Token（xoxb-）", appToken: "App Token（xapp-）" }, steps: ["api.slack.com/apps → Create New App", "打开 Socket Mode，生成 App Token，scope 选 connections:write", "OAuth & Permissions 加 Bot scopes：app_mentions:read chat:write im:history im:read im:write", "Event Subscriptions 订阅 app_mention、message.im；App Home 里允许发消息", "Install to Workspace，复制 Bot Token"] },
};
const STATE = { connected: ["已连接", "ok"], connecting: ["连接中", "warn"], error: ["连接失败", "err"], off: ["未连接", ""] };
const dotCls = (s) => STATE[s]?.[1] ?? "";
const PAGES = {
  profile: ["个人资料", "user", () => renderProfile],
  schedules: ["定时任务", "clock", () => renderSchedules],
  accounts: ["账户", "link", () => renderAccounts],
  models: ["AI 模型", "ai", () => renderModels],
  memory: ["记忆", "brain", () => renderMemory],
  skills: ["技能", "skill", () => renderSkills],
  security: ["安全", "lock", () => renderSecurity],
  about: ["关于", "info", () => renderAbout],
};
const GROUPS = [["profile", "schedules", "accounts", "models"], ["memory", "skills"], ["security", "about"]];
const PROFILE = [
  [["name", "姓名", "你的名字"], ["nickname", "昵称", "Tomo 应该怎么称呼你？"], ["birthday", "生日", "例如：1999-01-03"]],
  [["email", "邮箱", "you@example.com"], ["phone", "电话", "+86 138 0000 0000"], ["home", "住址", "城市或详细地址"], ["work", "工作", "职位 · 公司"]],
  [["household", "家庭", "例如：伴侣，2 个孩子"], ["interests", "兴趣", "例如：设计、木工"], ["pets", "宠物", "例如：叫 Max 的狗"]],
];
const ready = (p) => p.key.set || p.fromEnv;
const chHasToken = (c) => Object.keys(CH[c.id].fields).every((f) => c.fields[f]?.last4 || c.fields[f]?.fromEnv);
async function logout() { await api("/api/auth/logout", { method: "POST" }); token = localStorage.token = ""; location.reload(); }

let setStack = [], setFrom = "home", acctTab = "all";
function openSettings(page, arg) {
  if (view !== "settings") setFrom = view;
  setStack = page && (PAGES[page] || page === "account") ? [{ k: page, arg }] : [];
  go("settings");
}
function pushSet(k, arg) { setStack.push({ k, arg }); renderSettings(); }
function setBack() {
  if (setStack.length) { setStack.pop(); return renderSettings(); }
  go(setFrom);
}
const setRedraw = () => renderSettings(true);

async function renderSettings(keepScroll) {
  const root = $("setRoot"), top = setStack.at(-1), y = $("v-settings").scrollTop;
  if (!top) await renderSetHome(root);
  else {
    const title = top.k === "account" ? top.arg.label : PAGES[top.k][0];
    root.innerHTML = `<h1 class="setTitle serif">${esc(title)}</h1><div class="setBody"></div>`;
    await (top.k === "account" ? renderAccount : PAGES[top.k][2]())(root.lastElementChild, top.arg);
  }
  $("v-settings").scrollTop = keepScroll ? y : 0;
}

async function renderSetHome(root) {
  const [S, mem] = await Promise.all([api("/api/settings"), api("/api/memories")]);
  const P = S.profile ?? {};
  const who = P.nickname || P.name || "";
  const hasKey = S.providers.some(ready);
  const live = S.channels.filter((c) => c.enabled && c.status.state === "connected");
  const vals = {
    profile: who ? "" : "未填写",
    accounts: `${live.length + S.providers.filter(ready).length || "未连接"}${live.length + S.providers.filter(ready).length ? " 个" : ""}`,
    models: hasKey ? esc(S.model.modelId) : "未设置",
    memory: mem.length ? `${mem.length} 条` : "",
  };
  root.innerHTML = `
    <button class="setHead" data-k="profile">
      <span class="avatar">${who ? esc([...who][0].toUpperCase()) : ic("user", 26)}</span>
      <span class="grow"><span class="setName serif">${esc(who || "你好")}</span><span class="setSub">${esc(P.email || (who ? P.work || "" : "填写资料，让 Tomo 更懂你"))}</span></span>
    </button>
    <button class="statCard" data-k="${hasKey ? "models" : "accounts"}">
      <span class="statTop"><span class="serif">Tomo</span><span class="statModel">${hasKey ? `${ic("ai", 14)}${esc(S.model.modelId)}` : "还没接上 AI 模型"}</span></span>
      <span class="statChips">${S.channels.map((c) => { const on = c.enabled && chHasToken(c); return `<span class="chip ${on ? "" : "dim"}">${ic(c.id, 14)}${CH[c.id].label}<span class="dot ${on ? dotCls(c.status.state) : ""}"></span></span>`; }).join("")}</span>
    </button>
    ${GROUPS.map((g) => `<div class="group">${g.map((k) => `<button class="item" data-k="${k}">${ic(PAGES[k][1], 20)}<span class="grow">${PAGES[k][0]}</span><span class="val">${vals[k] ?? ""}</span><span class="arrow">${ic("right", 16)}</span></button>`).join("")}</div>`).join("")}
    <div class="group logoutRow"><button class="item" id="logout">${ic("logout", 20)}<span class="grow">退出登录</span></button></div>`;
  root.querySelectorAll("[data-k]").forEach((b) => (b.onclick = () => pushSet(b.dataset.k)));
  $("logout").onclick = logout;
}

async function renderProfile(body) {
  const S = await api("/api/settings");
  const P = S.profile ?? {};
  body.innerHTML = PROFILE.map((g) => `<div class="group">${g.map(([k, label, ph]) => `<label class="item kv"><span class="k">${label}</span><input data-p="${k}" value="${esc(P[k] ?? "")}" placeholder="${esc(ph)}" autocomplete="off" /></label>`).join("")}</div>`).join("") +
    `<p class="note">Tomo 每次回答都会参考这些信息。只保存在你自己的服务器上。</p>`;
  body.querySelectorAll("[data-p]").forEach((i) => (i.onchange = async () => {
    await api("/api/settings/profile", { method: "PUT", body: { [i.dataset.p]: i.value } });
    toast("已保存");
  }));
}

async function renderSchedules(body) {
  const list = await api("/api/schedules");
  body.innerHTML = list.length
    ? `<div class="group">${list.map((s) => `<div class="item"><span class="grow">${esc(s.title)}<div class="muted small">${s.next_run ? esc(when(s.next_run)) : "已结束"} · ${esc({ once: "一次", interval: "间隔", daily: "每天", cron: "cron" }[s.kind] ?? s.kind)} ${esc(s.spec)}</div></span><button class="dangerBtn" data-s="${esc(s.id)}">取消</button></div>`).join("")}</div>`
    : `<div class="empty">没有定时任务。<br/>在对话里说「每个工作日早上 8 点给我发今天的安排」。</div>`;
  body.querySelectorAll("[data-s]").forEach((b) => (b.onclick = async () => { await api(`/api/schedules/${encodeURIComponent(b.dataset.s)}`, { method: "DELETE" }); toast("已取消"); setRedraw(); }));
}

// ---- 账户: messaging platforms and AI providers in one list, each opens its own page ----
const mono = (label) => `<span class="logo mono">${esc(label[0])}</span>`;
async function renderAccounts(body) {
  const S = await api("/api/settings");
  const rows = [
    ...S.channels.map((c) => {
      const has = chHasToken(c), [st, cls] = !has ? ["", ""] : !c.enabled ? ["已关闭", ""] : STATE[c.status.state] ?? ["", ""];
      return { tab: "channels", id: `channel:${c.id}`, label: CH[c.id].label, logo: `<span class="logo">${ic(c.id, 20)}</span>`, sub: "消息平台 · 私聊和群聊", right: has ? `<span class="badge ${cls}">${st}</span>` : `<span class="pillBtn">连接</span>` };
    }),
    ...S.providers.map((p) => ({ tab: "providers", id: `provider:${p.id}`, label: p.label, logo: mono(p.label), sub: S.model.provider === p.id && ready(p) ? "AI 模型 · 当前主模型" : "AI 模型", right: p.key.set ? `<span class="badge ok">····${esc(p.key.last4)}</span>` : p.fromEnv ? `<span class="badge">环境变量</span>` : `<span class="pillBtn">添加</span>` })),
  ];
  const tabs = [["all", "全部"], ["channels", "消息平台"], ["providers", "AI 模型"]];
  body.innerHTML = `<div class="seg">${tabs.map(([k, l]) => `<button data-t="${k}" class="${acctTab === k ? "on" : ""}">${l}</button>`).join("")}</div>
    <div class="group">${rows.filter((r) => acctTab === "all" || r.tab === acctTab).map((r) => `<button class="item acct" data-a="${r.id}" data-l="${esc(r.label)}">${r.logo}<span class="grow"><span class="aName">${esc(r.label)}</span><span class="aSub">${r.sub}</span></span>${r.right}</button>`).join("")}</div>`;
  body.querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => { acctTab = b.dataset.t; setRedraw(); }));
  body.querySelectorAll("[data-a]").forEach((b) => (b.onclick = () => pushSet("account", { id: b.dataset.a, label: b.dataset.l })));
}
async function renderAccount(body, { id }) {
  const [kind, key] = id.split(":");
  return kind === "channel" ? renderChannel(body, key) : renderProvider(body, key);
}
async function renderChannel(body, id) {
  const S = await api("/api/settings");
  const c = S.channels.find((x) => x.id === id), meta = CH[id];
  const hasToken = chHasToken(c);
  const [st, cls] = !hasToken ? ["未设置", ""] : !c.enabled ? ["已关闭", ""] : STATE[c.status.state] ?? ["", ""];
  const on = hasToken && c.enabled;
  body.innerHTML = `<div class="group">
      <div class="item"><span class="logo">${ic(id, 20)}</span><span class="grow">状态 <span class="badge ${cls}">${st}</span></span>${hasToken ? `<input type="checkbox" class="toggle ${on && c.status.state !== "connected" ? "pending" : ""}" ${on ? "checked" : ""} aria-label="启用 ${meta.label}" />` : ""}</div>
      ${Object.entries(meta.fields).map(([f, label]) => {
        const v = c.fields[f] ?? {}, now = v.last4 ? `已保存 ····${esc(v.last4)}` : v.fromEnv ? "来自环境变量" : "";
        return `<div class="field"><label>${label} ${now ? `<span class="badge">${now}</span>` : ""}</label><input type="password" data-f="${f}" autocomplete="off" placeholder="${now ? "留空则不修改" : "粘贴 token"}" /></div>`;
      }).join("")}
      <div class="field"><div class="btns"><button class="primary save">保存并连接</button><span class="msg ${c.status.state === "error" ? "err" : ""}">${c.status.state === "error" ? esc(c.status.error) : ""}</span></div></div>
    </div>
    <div class="gtitle">怎么拿 token</div><div class="group"><div class="field"><ol class="steps">${meta.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></div></div>
    <p class="note">保存后立刻连接，不用重启。连上后去「安全」配对你的聊天账号。</p>`;
  const btn = body.querySelector(".save"), msg = body.querySelector(".msg"), tg = body.querySelector(".toggle");
  const save = async () => {
    // Saving a token means "connect it"; the toggle only pauses a channel that already has one.
    const b = { enabled: tg ? tg.checked : true };
    body.querySelectorAll("[data-f]").forEach((i) => { if (i.value.trim()) b[i.dataset.f] = i.value.trim(); });
    btn.disabled = true;
    flash(msg, "连接中…", true);
    const r = await api(`/api/settings/channels/${id}`, { method: "PUT", body: b });
    if (r.error) { btn.disabled = false; return flash(msg, r.error); }
    if (r.status.state === "connected") toast(`${meta.label} 已连接`);
    setRedraw();
  };
  btn.onclick = save;
  if (tg) tg.onchange = save;
}
async function testProvider(id, msg) {
  flash(msg, "测试中…", true);
  const r = await api(`/api/settings/providers/${id}/test`, { method: "POST", body: {} });
  r.ok ? flash(msg, `可以用 ✓ ${r.model}`, true) : flash(msg, r.error ?? "失败");
  return r.ok;
}
async function renderProvider(body, id) {
  const S = await api("/api/settings");
  const p = S.providers.find((x) => x.id === id);
  body.innerHTML = `<div class="group">
      <div class="item">${mono(p.label)}<span class="grow">状态 ${p.key.set ? `<span class="badge ok">····${esc(p.key.last4)}</span>` : p.fromEnv ? `<span class="badge">环境变量</span>` : `<span class="badge">未设置</span>`}</span>${p.key.set ? `<button class="dangerBtn del">删除</button>` : ""}</div>
      <div class="field"><label>API key</label><input type="password" autocomplete="off" placeholder="${p.key.set ? "输入新 key 替换" : "粘贴 API key"}" /><span class="muted small">${esc(p.hint)}</span></div>
      <div class="field"><div class="btns"><button class="primary save">保存</button><button class="ghost test" ${ready(p) ? "" : "disabled"}>测试</button><span class="msg"></span></div></div>
    </div>
    <p class="note">key 加密保存在你的服务器上，这里只显示末四位。默认用哪个模型在「AI 模型」里选。</p>`;
  const input = body.querySelector("input"), msg = body.querySelector(".msg");
  body.querySelector(".save").onclick = async () => {
    if (!input.value.trim()) return flash(msg, "先填 key");
    const r = await api(`/api/settings/providers/${id}`, { method: "PUT", body: { key: input.value } });
    if (r.error) return flash(msg, r.error);
    input.value = "";
    body.querySelector(".test").disabled = false;
    // first key ever: make it the default so Tomo works right away
    if (!S.providers.some(ready)) await useProviderAsDefault(id);
    await testProvider(id, msg);
  };
  body.querySelector(".test").onclick = () => testProvider(id, msg);
  body.querySelector(".del")?.addEventListener("click", async () => {
    if (await alertDialog({ title: `删除 ${p.label} 的 key？`, body: "用这家模型的对话会停止工作，直到你换一家。", confirm: "删除", danger: true })) { await api(`/api/settings/providers/${id}`, { method: "DELETE" }); setRedraw(); }
  });
}
const CHAT_HINT = /research|image|live|computer|tts|audio|embed|search|batch|realtime|transcribe/i;
async function useProviderAsDefault(id) {
  const list = (await api(`/api/settings/models?provider=${encodeURIComponent(id)}`)).filter((m) => !CHAT_HINT.test(m.id));
  if (!list.length) return null;
  const m = list[0].id;
  await api("/api/settings/model", { method: "PUT", body: { model: { provider: id, modelId: m }, smallModel: { provider: id, modelId: (list.find((x) => /mini|flash|haiku|small|lite/i.test(x.id)) ?? list[0]).id } } });
  return m;
}

async function renderModels(body) {
  const S = await api("/api/settings");
  const usable = S.providers.filter(ready);
  if (!usable.length) {
    body.innerHTML = `<div class="empty">还没有可用的模型。<br/>先在「账户」里添加一家 AI 供应商的 key。<div class="btns" style="justify-content:center;margin-top:14px"><button class="primary" id="toKeys">添加 key</button></div></div>`;
    $("toKeys").onclick = () => { acctTab = "providers"; pushSet("accounts"); };
    return;
  }
  const opts = usable.map((p) => `<option value="${p.id}">${esc(p.label)}</option>`).join("");
  body.innerHTML = `
    <div class="group">
      <div class="field"><label>主模型 · 对话</label><div class="row2"><select id="mp">${opts}</select><select id="mi"></select></div></div>
      <div class="field"><label>小模型 · 后台反思、子任务和面板刷新</label><div class="row2"><select id="sp">${opts}</select><select id="si"></select></div></div>
      <div class="field"><div class="btns"><button class="primary" id="saveM">保存</button><span class="msg" id="mMsg"></span></div></div>
    </div>
    <p class="note">只列出已经填了 key 的供应商。要加别家，去「账户」。</p>`;
  const fill = async (ps, is, want) => {
    const list = await api(`/api/settings/models?provider=${encodeURIComponent(ps.value)}`);
    is.innerHTML = list.map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join("");
    if (want && list.some((m) => m.id === want)) is.value = want;
  };
  for (const [ps, is, cur] of [[$("mp"), $("mi"), S.model], [$("sp"), $("si"), S.smallModel]]) {
    ps.value = usable.some((p) => p.id === cur.provider) ? cur.provider : usable[0].id;
    await fill(ps, is, cur.modelId);
    ps.onchange = () => fill(ps, is);
  }
  $("saveM").onclick = async () => {
    const r = await api("/api/settings/model", { method: "PUT", body: { model: { provider: $("mp").value, modelId: $("mi").value }, smallModel: { provider: $("sp").value, modelId: $("si").value } } });
    r.error ? flash($("mMsg"), r.error) : (flash($("mMsg"), "已保存", true), toast(`主模型：${r.model.modelId}`));
  };
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
  await load();
}

async function renderSkills(body) {
  const sk = await api("/api/skills");
  body.innerHTML = sk.length
    ? `<div class="group">${sk.map((s) => `<div class="item"><span class="grow"><strong>${esc(s.name)}</strong><div class="muted small">${esc(s.description)}</div></span></div>`).join("")}</div><p class="note">技能由 Tomo 在工作中自己写和改进。</p>`
    : `<div class="empty">还没有技能。<br/>Tomo 会把反复做的事沉淀成技能。</div>`;
}

async function renderSecurity(body) {
  const S = await api("/api/settings");
  const env = new Set(S.ownersFromEnv);
  body.innerHTML = `
    <div class="gtitle">配对的聊天账号</div>
    <div class="group">${S.owners.length ? S.owners.map((o) => `<div class="item"><span class="grow"><code>${esc(o)}</code></span>${env.has(o) ? `<span class="badge">环境变量</span>` : `<button class="dangerBtn" data-o="${esc(o)}">移除</button>`}</div>`).join("") : `<div class="item muted">还没有配对的账号</div>`}
      <div class="field"><div class="btns"><button class="ghost" id="pair">生成配对码</button></div><div id="pairBox" hidden><div class="code" id="code"></div><p class="note" style="margin:0;text-align:center">10 分钟内，用你的账号私聊机器人发送 <code id="cmd"></code></p></div></div></div>
    <p class="note">配对后，你在各平台私聊 Tomo 都会进同一个 Home 对话；别人的私聊会被忽略。</p>
    <div class="gtitle">网页登录密码</div>
    <div class="group">
      <div class="field"><label>当前密码</label><input type="password" id="cur" autocomplete="current-password" /></div>
      <div class="field"><label>新密码（至少 8 位）</label><input type="password" id="nxt" autocomplete="new-password" /></div>
      <div class="field"><div class="btns"><button class="primary" id="chg">修改密码</button><span class="msg" id="pMsg"></span></div></div></div>
    <p class="note">修改后，其他设备需要重新登录。</p>`;
  body.querySelectorAll("[data-o]").forEach((b) => (b.onclick = async () => { await api(`/api/settings/owners/${encodeURIComponent(b.dataset.o)}`, { method: "DELETE" }); setRedraw(); }));
  $("pair").onclick = async () => {
    const r = await api("/api/settings/pair", { method: "POST" });
    $("pairBox").hidden = false;
    $("code").textContent = r.code;
    $("cmd").textContent = `/pair ${r.code}`;
    const n = S.owners.length;
    const t = setInterval(async () => {
      if (!$("code")) return clearInterval(t);
      const s = await api("/api/settings");
      if (s.owners.length !== n) { clearInterval(t); toast("配对成功"); setRedraw(); }
    }, 3000);
    setTimeout(() => clearInterval(t), 600_000);
  };
  $("chg").onclick = async () => {
    const r = await api("/api/settings/password", { method: "PUT", body: { current: $("cur").value, next: $("nxt").value } });
    if (r.token) { token = localStorage.token = r.token; flash($("pMsg"), "已修改", true); $("cur").value = $("nxt").value = ""; }
    else flash($("pMsg"), r.error === "wrong password" ? "当前密码不对" : r.error);
  };
}

function renderAbout(body) {
  body.innerHTML = `<div class="group">
    <div class="item">${ic("sparkles", 20)}<span class="grow">Tomo</span><span class="val">个人 agent · Pi Durable + Bun</span></div>
    <a class="item" href="https://github.com/QinYangWang/tomo" target="_blank" rel="noopener"><span class="grow">源代码</span><span class="arrow">${ic("right", 16)}</span></a></div>
    <p class="note">数据全部在你自己的服务器上：data/ 目录。备份时连同 secret.key 一起。</p>`;
}

// ---------- first-run guide: profile, then an AI provider ----------
async function onboard(S) {
  const P = S.profile ?? {};
  let step = 0, pick = S.providers.find(ready)?.id ?? S.providers[0].id;
  const el = $("onboard");
  el.hidden = false;
  const finish = async () => {
    await api("/api/settings/onboarded", { method: "PUT", body: { done: true } });
    el.hidden = true;
    renderHome();
  };
  const dots = () => `<div class="obDots">${[0, 1].map((i) => `<span class="${i === step ? "on" : ""}"></span>`).join("")}</div>`;
  const draw = () => {
    if (step === 0) {
      el.innerHTML = `<div class="obCard">${dots()}
        <span class="obIcon">${ic("user", 26)}</span>
        <h1 class="serif">先认识一下</h1>
        <p class="muted">Tomo 会在每次对话里用到这些。之后可以在设置 → 个人资料里补充。</p>
        <div class="group">
          <label class="item kv"><span class="k">昵称</span><input id="obNick" value="${esc(P.nickname ?? "")}" placeholder="怎么称呼你？" /></label>
          <label class="item kv"><span class="k">姓名</span><input id="obName" value="${esc(P.name ?? "")}" placeholder="你的名字" /></label>
          <label class="item kv"><span class="k">工作</span><input id="obWork" value="${esc(P.work ?? "")}" placeholder="职位 · 公司" /></label>
        </div>
        <button class="primary big" id="obNext">下一步</button>
        <button class="linkBtn" id="obSkip">跳过</button></div>`;
      $("obNick").focus();
      $("obNext").onclick = async () => {
        await api("/api/settings/profile", { method: "PUT", body: { nickname: $("obNick").value, name: $("obName").value, work: $("obWork").value } });
        step = 1; draw();
      };
      $("obSkip").onclick = () => { step = 1; draw(); };
      return;
    }
    const p = S.providers.find((x) => x.id === pick);
    el.innerHTML = `<div class="obCard">${dots()}
      <span class="obIcon">${ic("ai", 26)}</span>
      <h1 class="serif">接上一个 AI 模型</h1>
      <p class="muted">Tomo 用你自己的 API key 思考。选一家，粘贴 key 就行。</p>
      <div class="provGrid">${S.providers.map((x) => `<button data-pv="${x.id}" class="${x.id === pick ? "on" : ""}">${esc(x.label)}${ready(x) ? ic("tick", 14) : ""}</button>`).join("")}</div>
      <div class="group"><div class="field"><input type="password" id="obKey" autocomplete="off" placeholder="${ready(p) ? "已保存，可直接完成或替换" : `${esc(p.label)} API key`}" /><span class="muted small">${esc(p.hint)}</span></div></div>
      <span class="msg" id="obMsg"></span>
      <button class="primary big" id="obGo">${ready(p) && S.model.provider === pick ? "完成" : "保存并测试"}</button>
      <button class="linkBtn" id="obSkip">稍后在设置里配置</button></div>`;
    el.querySelectorAll("[data-pv]").forEach((b) => (b.onclick = () => { pick = b.dataset.pv; draw(); }));
    $("obSkip").onclick = finish;
    $("obGo").onclick = async () => {
      const key = $("obKey").value.trim(), msg = $("obMsg");
      if (!key && !ready(p)) return flash(msg, "先粘贴 key");
      $("obGo").disabled = true;
      if (key) {
        const r = await api(`/api/settings/providers/${pick}`, { method: "PUT", body: { key } });
        if (r.error) { $("obGo").disabled = false; return flash(msg, r.error); }
      }
      if (S.model.provider !== pick || !ready(p)) await useProviderAsDefault(pick);
      if (!(await testProvider(pick, msg))) { $("obGo").disabled = false; S = await api("/api/settings"); return; }
      setTimeout(finish, 700);
    };
  };
  draw();
}

// ---------- boot ----------
async function boot(firstRun) {
  $("gate").hidden = true;
  convs = await api("/api/conversations");
  const S = await api("/api/settings");
  const hasKey = S.providers.some((p) => p.key.set || p.fromEnv);
  go(firstRun || !hasKey ? "home" : VIEWS.includes(localStorage.view) ? localStorage.view : "home");
  if (!S.onboarded && (firstRun || !hasKey || !(S.profile?.nickname || S.profile?.name))) onboard(S);
}
gate();
