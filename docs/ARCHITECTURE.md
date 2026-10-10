# Tomo 架构设计

> 一个大脑，多个入口。崩溃不丢活，越用越懂你。

## 1. 目标

| 能力 | 怎么实现 |
|---|---|
| 多消息平台 | 每个平台一个 `ChannelAdapter`（Telegram / Discord / Slack），统一进 `Gateway` |
| 多平台客户端 | HTTP + WebSocket API，自带 Web/PWA 客户端；iOS/Android 原生客户端用同一协议 |
| 项目管理 | `projects` 扩展：每个项目是独立会话，有自己的记忆空间、brief 和工作目录 |
| 持久记忆 | `memory` 扩展：SQLite + FTS5（trigram，中日英都能搜），有置信度、作用域 |
| 持续进化 | ① 反思循环自动提炼记忆和技能 ② 技能自写自改 ③ 插件自提案、主人批准后热加载 |
| 耐久运行 | Pi Durable：每步都是带 checkpoint 的 task，进程挂了重启后接着跑 |

## 2. 分层

```
 Telegram   Discord   Slack            Web / PWA / 未来 iOS·Android
     │         │        │                       │  REST + WebSocket
     └──── ChannelAdapter ────┐                 │
                              ▼                 ▼
                     ┌──────────────── Gateway ────────────────┐
                     │ 身份(owner/allowed) · 路由 · 命令 · 投递 │
                     └───────────────┬─────────────────────────┘
                                     ▼
          ┌──────────────── Pi Durable Harness ─────────────────┐
          │ conversations · tasks · documents · compaction       │
          │ Registry(扩展，可热替换):                            │
          │  persona · memory · projects · skills · scheduler    │
          │  delegate(子代理/历史/handoff/抓网页) · plugins      │
          │  coding tools(read/write/edit/bash, 在项目目录里跑)  │
          └───────┬──────────────────────────────┬──────────────┘
                  ▼                              ▼
         harness.sqlite                  app.sqlite + data/
   (转录、任务、文档；Bun 适配器)     (绑定、路由、项目、记忆、定时、统计)
```

两个库分开：harness 的存储是单进程独占、由 Pi Durable 管理 schema；应用自己的表放 `app.sqlite`，随便查、随便迁移。

## 3. 会话路由（"一个大脑"）

| 来源 | 会话 |
|---|---|
| 主人私聊，任何平台、Web | harness **root**（Home）：跨平台连续的一条对话 |
| 群聊 / 频道 | 每个频道一条会话 |
| 频道里的 thread | 频道会话在最新消息处 **fork**，两者并行、互不阻塞 |

- 你在 Telegram 说一半，到 Slack 接着说，它记得。
- 回复发回**最后一次说话的那个平台**（`routes` 表），定时任务的输出也发到那里。Web 只是旁观+输入，不抢路由。
- 每条平台消息的 `requestId = platform:chat:messageId`，平台重投递也只处理一次。
- 正在回答时又来新消息：用 `whenBusy: "steer"` 插进当前任务，而不是排队重答。

## 4. 记忆

一行一个"关于用户世界的持久陈述"：

```
kind:       profile | preference | person | place | fact | decision | episode
subject:    关于谁/什么（"user"、人名、地点、项目）
scope:      global 或 某个项目 id
confidence: stated(用户亲口说) | inferred(代理推断)
```

- **常驻**：profile + preference 每次请求都注入（`memory` 段），其余按需 `recall`。
- **写入纪律**（写在 persona 和反思提示里）：不比用户说的更笼统、更绝对；推断要标 inferred；不存一次性数值（价格、库存）；不存凭证/证件。
- 矛盾就 `update_memory`，不叠加；用户要求忘记就逐条 `forget`。
- 完整对话永远留在 harness 存储里，`search_history` 可以翻到压缩/handoff 之前。

## 5. 项目

每个项目是一个**独立的线程和 agent 上下文**：

- 新建项目（网页「项目」侧栏的 + 按钮直接开一个新对话，不弹窗；或在聊天里让 Tomo `project_create`）会创建一个**全新的会话**，不从任何对话 fork，所以每个项目都从零开始。会话的 `app.meta` 记着 `kind: "project"` 和 `projectId`，`cwd` 是 `data/projects/<id>/`。
- **记忆隔离**：记忆按空间存，`global` 属于日常聊天，每个项目 id 是自己的空间。项目里 `remember`、`recall` 和反思只碰本项目的空间；聊天只碰 `global`。两边互相看不到对方的记忆。
- 聊天只知道**有哪些项目**（名字和状态），不知道简报、记忆或对话内容。问到项目细节时，Tomo 会让用户去对应项目里聊。
- 项目 **brief** 只注入该项目自己的会话，由它主动维护（`project_update_brief`）。
- 新项目默认叫 `Untitled project`。项目 agent 收到第一条消息时用 `project_rename` 总结出项目名；如果它没改名，gateway 就截取第一条消息作为名字。
- 侧栏每个项目都有菜单：重命名（就地编辑）、归档或恢复、删除（二次确认）。删除会清掉项目行、它的记忆空间和工作目录。
- `/project` 命令只列项目，不再在当前对话里切换项目。

## 6. 持续进化

三条回路，从安全到强力：

1. **反思（自动）**：每 N 轮（`TOMO_REFLECT_EVERY`），后台反思会话（小模型）读最近对话 + 已有记忆，补记忆、修矛盾、把重复流程写成技能。它本身是 durable 会话，`requestId = reflect:<conv>:<turn>`，重启不重复。
2. **技能（代理自写）**：`data/skills/<name>/SKILL.md`，提示里只放索引（名字+描述），用时 `skill_load`。`skill_save` / `skill_edit` 改写时旧版本进 `.history/`，可回滚。
3. **插件（主人批准）**：缺能力时代理用 `plugin_propose` 写一个 Pi Durable 扩展到 `data/plugins/pending/`。主人 `/plugins <name>` 看代码，`/approve <name>` 才生效。生效后文件监听 + `registry.install()` 热替换，正在跑的调用用旧代码，下一次用新代码，不重启。

## 7. 耐久性

- 模型请求、每个工具调用、压缩、子代理都是 Pi Durable task，先存意图再执行。
- 只读/幂等工具标 `replay: "safe"`，崩溃后重跑；有副作用的（`project_create`、`schedule_create`、`handoff`）不标，崩溃时模型被告知"中断了"自己决定。
- 定时任务：先推进 `next_run` 再提交，`requestId = sched:<id>:<time>`，双保险不重复触发。
- harness 存储出错 → 进程退出码 1 → docker/systemd 拉起 → `harness.resume()` 接着干。

## 8. 客户端协议

```
GET  /api/conversations          Home + 各频道绑定
POST /api/conversations/:id/messages {text}
GET  /api/projects | /api/memories?q= | /api/schedules | /api/skills
DELETE /api/memories/:id
WS   /ws?conversation=home&token=…
     ← [snapshot]，之后每次提交一批 Pi Durable agent events
       (message_start / message_update(text_delta) / message_end / tool_execution_* / run_*)
     → {"type":"input","text":"…"} | {"type":"abort"}
```

迟到/重连的客户端先拿 snapshot 再收增量；多个客户端同时看同一会话、都能插话（Pi Durable 的 multiplayer）。

## 9. 主人命令

`/new` 新上下文 · `/stop` 中止 · `/status` 模型/项目/花费 · `/model anthropic/claude-sonnet-5-5` · `/project`（列出项目） · `/plugins [名]` · `/approve 名` · `/reject 名` · `/whoami`

## 10. 安全

- 只有 `TOMO_OWNERS` 的身份能私聊和用命令；`TOMO_ALLOWED` 只能在群里 @ 它。没配置主人时，私聊只回你的 id。
- bash/写文件工具对主人开放，权限等于运行用户：VPS 上用专门的低权限用户或容器跑。
- 花钱、对外发消息、不可逆操作：persona 要求先给方案等明确同意。需要硬约束时，用 `beforeTool` hook + memo 做审批（见 Pi Durable 的 Approval 示例），这是下一步。

## 11. 路线图

- [ ] 流式输出到 Telegram/Discord（编辑消息）
- [ ] 审批 hook：危险工具在聊天里弹"批准/拒绝"按钮
- [ ] 每个项目一个容器化执行环境（`env` 按会话返回远程 ExecutionEnv）
- [ ] 向量检索补充 FTS（sqlite-vec）
- [ ] 更多入口：LINE、飞书、邮件、iOS 原生（同协议）
- [ ] 每日简报 / 主动提醒（基于定时任务 + 邮件日历接入）
