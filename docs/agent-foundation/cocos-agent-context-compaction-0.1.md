# CocosAgent 上下文预算与压缩 0.1

日期：2026-10-12。适用范围：Creator 原生 Agent 的 TypeScript 内核；当前产品路径为 Cocos Creator 2.4.15。

## 目标

在每次模型请求前估算提示上下文大小，超出预算时压缩旧对话和旧工具结果。Agent 必须仍能追踪一次工具调用对应的回执、Creator 操作身份和未完成验收/恢复状态。

本实现移植固定上游 `learn-claude-code` 的 s08 Context Compact 机制，并按 Cocos 操作账本语义改写。摘要由确定性 TypeScript 代码生成，不让模型重述自己的历史结果，也不将省略的回执改写成成功结论。

## 请求前流程

1. `AgentKernel` 在每次 Provider 请求前调用 `prepareAgentContext`。默认预算为 64,000 个估算 token；默认保留最近 10 条消息和最近 4 组工具交互。预算容纳完整的 Creator 2.4 工具合同目录及常规任务上下文，同时为会话历史保留压缩空间。`AgentKernelOptions.contextBudget` 可为测试或不同模型覆盖这些值。
2. 预算估算按消息与工具 schema 的 UTF-8 JSON 大小除以 3，并为高细节图片按张增加 2,048 token。它是保守估算，不是 DeepSeek tokenizer 的精确计量。
3. 未超预算时按原样发送模型上下文。超预算时生成确定性摘要，保留当前任务原文、少量历史对话注记、被折叠工具交互索引、操作身份和待办状态；近期交互以完整的 assistant tool call 与 tool result 成对保留。
4. 已结束的旧交互可折叠为 `callId → resultCallId`，并保留工具名、访问级别、`operationId/pipelineId/workflowId/buildId/batchId/releaseId`、验收状态与简短回执摘要。近期只读工具结果在必要时可缩短，但调用 ID 和结果 ID 仍相同。
5. 待预览、待运行验收、待审核/恢复或缺回执交互不作为普通旧历史丢弃。缺失、重复、工具名不符或先后次序异常的 call/result 不会作为畸形消息对发给 Provider；摘要会明确记录配对状态和对应 operation ID。Agent 从本轮完整 receipt 中提取身份与状态，避免大回执被 Provider 消息的 100 KB 预览截断后丢失关键字段。
6. 压缩后仍超预算时，内核停止本轮，不发 Provider 请求、不执行后续工具；回执和不确定写入状态仍留在结果及操作记录中。面板收到 `context.budget-exceeded` 并显示估算值与预算。

## 完整轨迹与展示

- 压缩只作用于发给 Provider 的拷贝；内核规范消息数组和 `AgentRunResult.messages` 不被原地改写。`AgentRunResult.receipts` 继续保留完整工具回执。
- `ContextCompactionReport` 记录压缩前后估算预算、折叠交互的 call/result ID、配对状态、工具、操作身份、验收摘要和未配对结果。Creator Host 将这些摘要事件写入本机 Agent 运行轨迹，并发送到 Creator 面板。
- 面板显示压缩次数、折叠调用数、操作身份数和待验收/恢复项数；具体 operation ID 与状态在事件详情和本地轨迹内保留。
- 本功能不是跨会话长期记忆，不替代 Creator 操作账本；Host 原有会话消息窗口仍独立受限。

## 自动化验收与边界

在 `tools/cocos-agent-runtime/` 执行 `npm test`：TypeScript 编译及 31 项 Node.js 测试通过。针对性回归覆盖：

- 压缩后 call ID 与 result ID 成对、operation ID 保留、`needs-preview` 仍待验收；
- 后续 `preview=passed` 清除对应的待验收状态，同时历史调用仍可追踪；
- 缺失或孤立回执被显式记为未配对，不向 Provider 发送断裂的工具调用；
- Provider 结果截断时从完整 receipt 找回 operation ID 和验收状态；
- 压缩只修改 Provider 视图，运行结果仍返回原始完整消息；
- 关键图片或未完成状态无法塞入预算时，停止 Provider 调用。
- 51 项 Creator 工具目录在默认预算下可进入首轮请求，防止固定工具合同本身触发首轮超限。

目前没有在 Creator 面板实机触发超预算路径，也没有用 DeepSeek 上下文拒绝来测试模型侧限额。压缩阈值与图片估算仍是配置化启发值；若模型在低于本地预算时仍拒绝请求，当前内核会按普通模型错误停止，不自动重试或继续执行工具。
