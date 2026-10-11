# CocosAgent 工程隔离长期记忆合同 0.1

状态：**TS/Host 实现与自动测试完成；Creator 2.4.15 面板实机验收待做。**

## 目标与上游关系

本切片把 learn-claude-code 固定基线 `0dcafa2ae053a1ddd6a72f265431104b08a5aa13` 的有限跨会话记忆与任务召回机制，用 TypeScript 独立实现，并按 Creator 工程、来源、审批和恢复语义适配。实现参考 [上游 s09_memory](https://github.com/shareAI-lab/learn-claude-code/blob/0dcafa2ae053a1ddd6a72f265431104b08a5aa13/s09_memory/code.py)。没有复制上游 Python；不包含自动推断/抽取、自动归档、用户级跨项目记忆、通用文件工具或上游完整 memory manager。

记忆只补充跨任务知识；当前用户要求、项目 `AGENTS.md`、实时 Creator 回执和操作账本优先。它不代表当前编辑器状态，不得用记忆替代 `scene.snapshot` 等实时核验，也不把 Creator 写入操作记录混为记忆。

## 身份与持久化

- Host 使用已注册工程的 `fs.realpathSync(projectRoot)` 规范路径计算 SHA-256，作为唯一工程键。不同规范路径使用独立文件；同一路径的符号链接会归一到同一工程身份。
- 文件保存在操作系统用户状态目录：`<state-root>/CocosAgent/assistant-sessions/<project-sha256>/project-memory-v1.json`。macOS/Linux 默认 state root 为 `~/.local/state`，可由现有 `XDG_STATE_HOME` 配置覆盖；Windows 使用 `LOCALAPPDATA`。
- 工程文件之外存储，不进入 Creator 项目、场景、资源、Git 或 Cocos 操作账本。POSIX 目录权限为 `0700`、数据文件为 `0600`。写入使用文件锁、修订号比较、临时文件 `fsync` 与原子 rename；旧 Host 遗留锁在确认 PID 已结束后可回收。
- 存储最多 8 MB、200 条有效记忆、500 条操作记录/删除墓碑；超限写入以无副作用错误拒绝。读取时校验工程键、版本、字段边界与凭据样式内容，损坏或错工程文件拒绝召回。
- 任务启动时以确定性的本地词项匹配选择最多 5 条相关记忆；不会调用模型来自动生成记忆摘要。选中的记忆及其来源随本次请求发送给用户配置的模型 Provider。面板批准控制保存、纠正和删除，不控制该次模型请求对已召回上下文的使用。

## 记忆和来源

每条记忆有稳定 `memoryId`、从 1 递增的 `revision`、标题、正文、类别、创建/更新时间、来源数组和最近 10 个旧版本。类别为 `user-preference`、`project-fact`、`workflow`、`decision`、`constraint`。

支持两种来源：

- **用户来源：** 精确引用当前任务（`messageIndex=0`）或本轮输入所带历史中的用户消息。Host 要求引文确实出现在对应文本中，并记录 `runId`、消息序号、原文片段和记录时间。
- **工具来源：** 精确引用同一 Agent run 的成功工具回执。引文须逐字出现在回执 JSON/文本中；来源记录 `runId`、`callId`、工具名、可用的 Creator `operationId`、原文片段与时间。失败回执、其他 run 的 call ID 和伪造片段不接受。

记忆标题/正文/来源中识别到 API token、Bearer token、常见云/API 凭据或私钥内容时拒绝保存。已持久化内容在召回前也做同样检查，避免手工损坏或旧文件中的凭据进入模型上下文。记忆按历史数据处理，作为 JSON 数据传入，并明确要求模型不把其内容当作指令。

## Creator Agent 工具

| 工具 | 访问 | 行为 |
| --- | --- | --- |
| `cocos_2x_memory_search` | read | 搜索本工程；空查询列最近项。返回 ID、修订号和来源 |
| `cocos_2x_memory_get` | read | 按精确 ID 读取内容、来源和纠正历史 |
| `cocos_2x_memory_remember` | write | 新建有来源的持久记忆；同名项拒绝，提示读取并纠正现有条目 |
| `cocos_2x_memory_correct` | write | 必须给出当前 `expectedRevision` 和新的可核验来源；旧版本及旧来源保留在最近 10 版历史中 |
| `cocos_2x_memory_delete` | write | 必须给出当前 ID/修订号；移除有效内容及历史，只留不含内容的 ID/修订号/时间/操作 ID 墓碑 |
| `cocos_2x_memory_operation_get` | recovery | 按 provider tool-call ID 查询精确的 remember/correct/delete 回执，或确认未记录 |

所有记忆写入都经过 Creator 面板现有批准回调；如果当前工程有 `AGENTS.md`，也服从同轮内容哈希门槛。纠正和删除使用修订号比较，避免覆盖已更新的记忆。Agent 策略要求用户明确提出遗忘/删除具体记忆后才能提交删除调用，删除仍需面板批准。

记忆操作 ID 使用模型返回的精确 tool-call ID。Host 中断或保存后回执丢失时，Agent 只获得原操作的恢复工具；读取原记忆存储账本后才允许继续。若原操作已提交，恢复返回具体记忆/版本；若没有记录，返回 `no-effect`，不会自动重复写入。

## 验收边界

- TS runtime 当前全套测试：41/41；覆盖来源校验、任务召回、修订号冲突、旧版本来源、内容删除、精确恢复、审批、项目键隔离和凭据拒绝。
- MCP/Creator 扩展当前全套测试：79/79；额外覆盖本机状态目录隔离、文件权限、并发写入、CAS、死 Host 锁回收、Host 恢复读回和扩展包包含存储适配器。
- Creator 面板还未实际验收：批准创建 → 新请求/重开 Host 后召回 → 纠正并查看新旧来源 → 删除后搜索为空。不能把模拟 Provider、自动测试或磁盘包生成写成面板实机通过。
- 当前只接入 Cocos Creator 2.4.15 Creator 原生 Agent；没有向 3.8 新增记忆工具或宣称 3.8 支持。

## 文件入口

- TS 记忆合同与内存操作：[project-memory.ts](../../tools/cocos-agent-runtime/src/project-memory.ts)
- Host 本地持久化：[assistant-memory-store.mjs](../../tools/cocos-agent-bridge/mcp/assistant-memory-store.mjs)
- Creator Host 接入：[creator-host-adapter.ts](../../tools/cocos-agent-runtime/src/creator-host-adapter.ts)、[assistant-host.mjs](../../tools/cocos-agent-bridge/mcp/assistant-host.mjs)
- 上游章节映射：[UPSTREAM.md](../../tools/cocos-agent-runtime/UPSTREAM.md)
