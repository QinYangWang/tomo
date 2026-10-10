# Tomo

基于 [Pi Durable](https://earendil.com/posts/pi-durable/) 和 Bun 的个人 agent：一个大脑，Telegram / Discord / Slack / Web 多个入口，带项目管理、持久记忆和持续进化。进程崩溃、VPS 重启，正在做的事接着做。

设计详见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 快速开始

```bash
bun install
cp .env.example .env      # 填模型 key 和至少一个平台 token
bun run start
```

第一次私聊机器人，它会回你的平台 id，填进 `TOMO_OWNERS` 后重启。Web 客户端在 `http://localhost:8787`。

## 部署到 VPS

```bash
git clone <repo> /opt/tomo && cd /opt/tomo
cp .env.example .env && vim .env
docker compose up -d --build
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
  config.ts               全部配置来自环境变量
  storage/bun-sqlite.ts   Pi Durable SQLite 核心的 bun:sqlite 适配器
  agent/
    harness.ts            模型、扩展注册、执行环境、resume
    extensions/           persona · memory · projects · skills · scheduler · delegate
    evolve/               reflection(反思循环) · plugins(自提案插件，热加载)
  app/                    app.sqlite：记忆、项目、定时任务
  gateway/                路由、身份、命令、投递
  channels/               telegram · discord · slack
  scheduler/loop.ts       定时任务触发
  server/http.ts          REST + WebSocket
web/                      PWA 客户端
test/smoke.test.ts        faux 模型端到端：工具调用→记忆→投递→重启恢复
```

## 加一个新平台

实现 `src/gateway/types.ts` 里的 `ChannelAdapter`（`start / send / typing / stop`），在 `main.ts` 注册即可。

## 测试

```bash
bun test          # 不需要 API key
bun run typecheck
```
