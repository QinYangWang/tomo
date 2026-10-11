# Tomo

基于 [Pi Durable](https://earendil.com/posts/pi-durable/) 和 Bun 的个人 agent：一个大脑，Telegram / Discord / Slack / Web 多个入口，带项目管理、持久记忆和持续进化。进程崩溃、VPS 重启，正在做的事接着做。

设计详见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 快速开始

```bash
bun install
bun run start
```

不需要 `.env`。打开 `http://localhost:8787`：

1. 第一次打开先设管理员密码。
2. **设置 → AI 模型**：填任意一家的 API key（Anthropic、OpenAI、Gemini、OpenRouter、DeepSeek、xAI、Groq、Mistral），点「测试」，再选主模型和小模型。
3. **设置 → 消息平台**：填 Telegram / Discord / Slack 的 token，「保存并连接」立即生效，不用重启。
4. **设置 → 主人账号**：生成配对码，用你自己的账号私聊机器人发 `/pair <码>`。各平台都配对后，私聊共享同一个 Home 对话。

key 和 token 用 AES-256-GCM 加密存在 `data/app.sqlite`，密钥在 `data/secret.key`（0600）。备份 `data/` 时这两个要一起。环境变量仍然可用（适合无界面部署），网页里保存的值优先。

## 部署到 VPS

```bash
git clone <repo> /opt/tomo && cd /opt/tomo
docker compose up -d --build          # 然后浏览器打开，按上面 1–4 配置
# HTTPS: 用 deploy/Caddyfile 反代 127.0.0.1:8787
```

不用 Docker 就用 `deploy/tomo.service`（systemd）。`data/` 是全部状态，备份它就够了。

## 各平台准备

- **Telegram**：@BotFather 建 bot，拿 token。群里 @ 它或回复它才会响应。
- **Discord**：Developer Portal 建应用 → Bot，打开 *Message Content Intent*，邀请时勾 `bot` + 发消息权限。
- **Slack**：建 App → 开 *Socket Mode*（拿 `xapp-` token，scope `connections:write`）→ Bot scopes：`app_mentions:read chat:write im:history im:read im:write` → 订阅事件 `app_mention`、`message.im` → 安装拿 `xoxb-` token。用 Socket Mode，VPS 不需要公网 webhook。

## 目录

```
src/
  main.ts                 启动：harness → gateway → 平台 → 定时器 → HTTP
  config.ts               启动参数（端口、数据目录）；其余配置在网页设置页
  storage/bun-sqlite.ts   Pi Durable SQLite 核心的 bun:sqlite 适配器
  agent/
    harness.ts            模型、扩展注册、执行环境、resume
    extensions/           persona · memory · projects · skills · scheduler · delegate
    evolve/               reflection(反思循环) · plugins(自提案插件，热加载)
  app/                    app.sqlite：记忆、项目、定时任务、settings.ts（加密设置、登录、配对）
  gateway/                路由、身份、命令、投递
  channels/               telegram · discord · slack
  scheduler/loop.ts       定时任务触发
  server/http.ts          REST + WebSocket
ui/                       React 客户端（Vite + TanStack Router/Query + React Aria），构建到 ui/dist 由 Hono 托管
test/smoke.test.ts        faux 模型端到端：工具调用→记忆→投递→重启恢复
```

## 加一个新平台

实现 `src/gateway/types.ts` 里的 `ChannelAdapter`（`start / send / typing / stop`），在 `main.ts` 注册即可。

## 测试

```bash
bun test          # 不需要 API key
bun run typecheck
```

## 前端开发

```bash
bun run build     # 构建 ui/dist（生产环境由 Hono 直接托管，未知路径回退到 index.html）
bun run dev:ui    # Vite 开发服务器，/api 和 /ws 代理到 :8787
```
