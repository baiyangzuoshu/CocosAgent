# Creator 内置 Assistant 0.1

状态：2026-10-10，Windows + Creator **2.4.15** + DeepSeek **Flash** 完成首条实机切片。面板内直接对话并切换 Ask、Plan、Agent；此次写入范围为独立临时空节点。不是完整 Unity Assistant 功能集，不表示 3.8 或全部 MCP 工具已经通过真实模型验收。

## 使用

1. 打开 `2.4.15NewProject`，启用 `cocos-agent-bridge` 扩展。
2. 本机安装 Node.js 20+，在 `tools/cocos-agent-bridge/mcp/` 执行 `npm ci`。可用 `COCOS_AGENT_NODE` 指定 Node 路径。
3. 菜单 **扩展 → CocosAgent → Assistant**。可在项目根目录 `.env.local` 中配置 `DEEPSEEK_API_KEY`，扩展会启动时自动连接；也可在面板输入 Key 后连接并保存。
4. 选择模式，在面板直接输入。Enter 发送，Shift+Enter 换行。Agent 每项非只读操作均显示工具及完整参数，批准后执行；拒绝或等待超过 120 秒不会执行该项。

项目根目录 `.env.local` 已被 Git 忽略。面板默认勾选“保存到项目根目录 .env.local”，连接时会保存 `DEEPSEEK_API_KEY` 与模型；Creator 扩展下次启动时自动恢复连接，密码框不会回填 Key。取消勾选后连接会移除文件内已有的 DeepSeek Key 与模型；“忘记 Key”会停止当前服务并清除这两项，同时保留文件中的其他本地变量。`.env.local` 按普通文本保存，请勿提交或分享该文件。Flash 已真实验收，V4 Pro 仅有配置选项，未在本轮调用。

## 三种模式

| 模式 | 模型可用工具 | 本轮实测 |
| --- | --- | --- |
| Ask | 仅 `readOnlyHint=true` 的 MCP 工具 | 查询实例、能力、场景和 Canvas；没有项目写入 |
| Plan | 同上；回答有序步骤与验证、恢复条件 | 为临时节点给出中文计划，没有创建节点 |
| Agent | 当前 2.4 MCP 工具；非只读调用逐项批准 | 拒绝、批准创建、记录读回、身份核对、补偿、节点不存在读回 |

模式过滤由 Agent 服务执行，UI 切换不能扩大权限。每轮先查询已注册项目的就绪实例，再读取能力；未注册项目、不可用命令及未查询实例会被拒绝。遇到不确定写入，只允许操作查询/对账，禁止盲目重发。模型多工具并发响应整批不执行，最多两次纠正后停止。

Plan 会输出带版本号的结构化步骤卡，字段包含说明、前置条件、验证和恢复；用户点击开始后进入 Agent，每次只开始当前一步，完成后用户逐步点击继续。前一步成功的 MCP 工具回执会作为只读观察传入下一步，支持延续节点 UUID / operation ID 等现场证据。每个写操作仍需单独审批；拒绝后可重试当前未执行步骤，不确定结果会锁定计划等待回执核对。计划保存在服务内存，Agent 是已有 MCP 合同范围内的操作，不含任意 JavaScript、脚本文件编辑或终端工具。

## 实现与凭据

`panel/index.js → Creator IPC/main.js → assistant-host.mjs → deepseek-agent.mjs → MCP stdio → JSONL Host → 2.4 扩展`。

- 面板使用官方 `Editor.Panel.extend` 和 `messages(event, ...args)` 接收 IPC，参见 [2.4 面板参考](https://docs.cocos.com/creator/2.4/manual/zh/extension/reference/panel-reference.html) 与 [IPC 工作流](https://docs.cocos.com/creator/2.4/manual/zh/extension/ipc-workflow.html)。扩展声明 `dockable`；本轮实际为独立编辑器窗口，拖入主窗口的停靠交互尚未验收。
- 本地对话服务只监听 `127.0.0.1` 随机端口，使用随机令牌路径。主进程通过子进程环境传 Key，不放入命令行；MCP 子进程过滤 `DEEPSEEK_*` 环境变量。
- Key 由 `.env.local` 提供或在面板输入；勾选保存时写入项目根目录的本地 `.env.local`，由 `.gitignore` 排除，连接后密码框清空；扩展启动时自动恢复。取消勾选或点“忘记 Key”可移除配置。主进程通过子进程环境传 Key，不放入命令行；轨迹按实际 Key 和 `sk-` 格式脱敏。
- 使用 DeepSeek Chat Completions，当前为非流式调用；工具方式依据 [DeepSeek 官方 Tool Calls](https://api-docs.deepseek.com/guides/tool_calls/)。回答按最新用户消息语言生成。
- 会话上下文在服务内存中，最多 24 条用户/助手消息，每条 8000 字符；重启服务会丢失。操作轨迹包含任务、工具回执及模型最终回答，保存在 `%LOCALAPPDATA%/CocosAgent/agent-runs/`；项目写入账本仍在 `.cocos-agent/operations/`。
- 模型最终文字不是编辑器回执。Agent 完全没有有效任务工具回执时，进行有限纠正，仍无回执则面板显示“任务未确认完成”并隐藏模型完成声明。这只防止本轮发现的无回执声明，不能视为对每句模型回答的语义真实性证明。

## 真实验收

过程证据见 [JSONL](traces/cocos-agent-assistant-2.4-deepseek-20261010.jsonl)。其中保留失败状态，不能把 `model.response`/最终文字当成已执行动作。

| 项目 | runId / 操作 | 结果 |
| --- | --- | --- |
| Ask | `0691f223-95d0-46b6-ae8f-f0fe6ae64293` | 只读场景与 Canvas，7 个原有子节点；场景 SHA 未变化 |
| Plan | `473b8310-e595-45ef-98fe-06ab2ae32f7a` | 只读实例/能力，中文步骤；没有写入 |
| Agent 拒绝 | `a41bfa18-8cf5-47c8-888a-e5db275cde6d` | 参数已显示，拒绝后 `write_not_approved`；没有新增节点 |
| 首次批准失败 | `603a8492-edc5-4f26-97f6-4509eaf40c18` / `c137d3bd-fbe9-4e89-a92b-00d6aadaac8e` | Windows fsync 报 EPERM，发生在编辑器写入前；保留全 pending 初始账本 |
| 按账本对账 | `14d4b9d9-91f0-4a02-8eed-49db23e2f4bf` / 同一失败操作 | 在面板批准 `operation.reconcile`；活动场景与磁盘共同确认无副作用，追加 `no-effect`/`recovery=passed`，没有重试写入 |
| 批准创建 | `75a7e52c-27ef-421e-a639-770f62493d34` / `862237a8-72d1-44ef-935c-34d695c665e0` | 实际创建 `AssistantAcceptanceTemp20261010`，编辑器、磁盘和独立节点读回通过 |
| 无回执完成声明 | `247fa9a1-5a5e-43af-9ae0-74b91dfe5ea8` | 模型未调用工具却声称补偿；runner 判为未完成。发现面板仍显示原文后修复隐藏逻辑，并加回归测试；该轮没有清理节点 |
| 真实补偿 | runId `3515cc54-479f-4504-828e-72299acb711e` / 操作 `b95dda19-ebe7-455d-bbb0-9f9f72392eaa`，来源为已创建操作 | 面板重新提交并批准，按来源 UUID 删除；账本 `completed/recovery=passed`，实时检查 `not-found`，磁盘无节点 |

成功节点 UUID 为 `89ZGYpS9hI8Ltmu/EIHiIz`，Canvas UUID 为 `a286bbGknJLZpRpxROV6M94`。空节点无需像素画面验收，`preview=skipped`；通过真实层级列表确认出现和清除，不冒称 Sprite/Web 预览已通过。

批准参数、节点创建与补偿画面：

- [批准前](traces/visual/assistant-2.4-approval-20261010.jpg)
- [创建后](traces/visual/assistant-2.4-created-20261010.jpg)
- [真实补偿后](traces/visual/assistant-2.4-compensated-20261010.jpg)

补偿后的场景 JSON 与测试前备份深度比较完全一致（21 个序列化对象、无临时节点）；Creator 保存改变了文本格式，随后只在语义一致检查通过后恢复原字节。最终 `helloworld.fire` SHA-256：

```text
8ae57957e06f0ed025f0e4886f9274f0a739969bef8b9a86dfef980b7a774e85
```

既有 `RepairRedA20261010` 节点、资源和未完成流水线均保留；没有对阻塞的资源流水线改用其他通道清理。

## 修复与自动测试

- 面板 IPC 改用 `messages`；主进程处理器接收 `(event, payload)`，统一消息名。连接失败恢复按钮、断线结束 busy/审批状态。
- Windows 操作账本以可写句柄执行 `fsync`，保留落盘检查。
- 对账仅新增严格的 **2.4 空节点初始记录**：零回执、六阶段全 pending、无组件/变换/Prefab/来源记录。必须证明同一父节点 UUID、活动场景目标缺席、磁盘目标缺席；不自动执行或删除其他账本。
- 修复工具回执包装、重复事件、模型并发工具纠正、无任务回执的面板完成声明；关闭 socket 取消待批操作。
- 调度测试中的 POSIX 固定路径改为 `os.tmpdir()` 绝对路径，Windows 目录链接使用 junction；这属于测试夹具适配，不扩大 3.x 产品范围。

2026-10-10 本轮增加 `.env.local` 凭据读写/自动恢复和结构化 Plan 步骤卡。真实 Ask 已在不重新输入 Key 的情况下回答活动场景；之后的真实 Plan 首次暴露 Host 读取工具回执层级错误，已修复并为成功/失败/缺失回执补充回归测试。修复后 MCP 目录 `npm test` 共 **30/30** 通过，`git diff --check` 通过；`.env.local` 命中根 `.gitignore` 的 `.env.*` 规则，未被跟踪。Plan 卡修复后的 Creator 面板实机复跑未完成：用户按下 Escape 停止了本轮 Windows Computer Use，因此不要把旧 Plan 轨迹表述成修复后的复验。

首轮验收还运行过 MCP 目录 `npm test`（20 项）、`operation-reconcile.test.js`（6 项）、`agent-dispatch.test.js`、`scene-node-create-contract.test.js` 和 `operation-store.test.js`；输出见[历史测试记录](traces/cocos-agent-assistant-tests-20261010.txt)。本轮自动测试扩展至 30 项并全部通过。真实 DeepSeek API、Creator UI 与 MCP stdio 实机测试记录在上表和轨迹中，不能用自动测试代替这些实际回执。

## 后续范围

尚未完成：流式回答、Markdown 渲染、聊天持久化/多会话、计划编辑、任务取消、上下文附件/选择对象引用、差异预览、全面 Unity 交互对齐。计划逐步执行尚待 Creator 实机与 DeepSeek 真模型端到端回归。Agent 当前的实机编辑操作只验收空节点和其恢复；资源、Prefab、构建和运行时虽有已有 Host 能力，需另按具体模型任务逐项验收。3.8 按当前项目范围暂停。
