# CocosAgent 上下文预算与压缩 0.1

日期：2026-10-12；Host 会话摘要更新：2026-10-16。适用范围：Creator 原生 Agent 的 TypeScript 内核与 Host；当前产品路径为 Cocos Creator 2.4.15。

## 目标

在每次模型请求前估算提示上下文大小，超出预算时压缩旧对话和旧工具结果。Agent 必须仍能追踪一次工具调用对应的回执、Creator 操作身份和未完成验收/恢复状态。

本实现移植固定上游 `learn-claude-code` 的 s08 Context Compact 机制，并按 Cocos 操作账本语义改写。摘要由确定性 TypeScript 代码生成，不让模型重述自己的历史结果，也不将省略的回执改写成成功结论。

## 请求前流程

2026-10-15 修正：Provider 超限后降至原有效预算的 65%，语义摘要必须沿用该更小预算；同一 run 后续回合继续使用它。回归检查实际发送的请求确实缩小，避免摘要分支重新使用原预算、重复发送相同请求。

1. `AgentKernel` 在每次 Provider 请求前调用 `prepareAgentContext`。默认预算为 64,000 个估算 token；默认保留最近 10 条消息和最近 4 组工具交互。预算容纳完整的 Creator 2.4 工具合同目录及常规任务上下文，同时为会话历史保留压缩空间。`AgentKernelOptions.contextBudget` 可为测试或不同模型覆盖这些值。
2. 预算估算按消息与工具 schema 的 UTF-8 JSON 大小除以 3，并为高细节图片按张增加 2,048 token。它是保守估算，不是 DeepSeek tokenizer 的精确计量。
3. 未超预算时按原样发送模型上下文。超预算时只把被省略的历史 user/assistant 对话交给当前 Provider 的无工具摘要请求，提示它压缩耐久任务事实、用户约束、决策与未解问题；项目/工具内容按不可信数据处理。当前任务原文、被折叠工具交互索引、操作身份和待办状态由本地代码独立保留，不由模型摘要决定；近期交互以完整的 assistant tool call 与 tool result 成对保留。Provider 不支持摘要、摘要失败或摘要为空时，使用本地确定性历史注记。
4. 已结束的旧交互可折叠为 `callId → resultCallId`，并保留工具名、访问级别、`operationId/pipelineId/workflowId/buildId/batchId/releaseId`、验收状态与简短回执摘要。近期只读工具结果在必要时可缩短，但调用 ID 和结果 ID 仍相同。
5. 大型工具结果先保存到本机 run 专属档案，再以短预览和精确 `callId` 放回消息；Agent 可调用只读 `agent_tool_result_read`，按字符偏移分段读取当前 run 的证据。读取没有路径参数、目录枚举或跨 run 查询能力，每次最多返回 8,000 字符。档案目录/文件分别使用 `0700/0600` 权限，单条结果最多 5 MiB、每个 run 最多 20 MiB；结果不可归档时给出明确失败回执，不假装可恢复。图片块不写入文本档案，仍按原有图片消息路径处理。
6. 待预览、待运行验收、待审核/恢复或缺回执交互不作为普通旧历史丢弃。缺失、重复、工具名不符或先后次序异常的 call/result 不会作为畸形消息对发给 Provider；摘要会明确记录配对状态和对应 operation ID。Agent 从本轮完整 receipt 中提取身份与状态，避免大回执被 Provider 消息的 100 KB 预览截断后丢失关键字段。恢复锁定期间，Creator policy 仍只允许精确恢复工具；证据读取不会绕过此限制。
7. 工具结果缩减在历史摘要之前进行；运行记录及完整 receipts 不被压缩器原地修改。压缩报告继续记录省略结果的精确身份与验收状态，必要时模型再读取档案原文证据。
8. 压缩后仍超本地预算时，内核停止本轮，不发 Provider 请求、不执行后续工具；回执和不确定写入状态仍留在结果及操作记录中。若 Provider 明确返回 context-length overflow，内核将本轮预算降至原预算的 65%，再压缩并重试一次；第二次 overflow 或较小预算仍装不下时停止。其他 Provider 错误不重试。面板收到压缩来源、`context.compacted` 或 `context.budget-exceeded` 事件。
9. Assistant Host 另按 conversation ID 持久化摘要，在最近消息窗口裁剪前更新，Host 从工程隔离状态存储恢复后继续携带。摘要保存 Provider/确定性摘要正文、覆盖消息数、摘要来源与源哈希，并最多保留最近 24 条用户消息的 1,200 字符原文片段。原文片段不授予权限；若精确回忆所需文本不在片段内或已截断，模型必须说明无法从留存来源确认，不能从模型摘要猜测。摘要/片段只属于对话上下文，不是项目长期记忆。

## 完整轨迹与展示

- 压缩只作用于发给 Provider 的拷贝；内核规范消息数组和 `AgentRunResult.messages` 不被原地改写。`AgentRunResult.receipts` 继续保留完整工具回执。
- `ContextCompactionReport` 记录压缩前后估算预算、折叠交互的 call/result ID、配对状态、工具、操作身份、验收摘要和未配对结果。Creator Host 将这些摘要事件写入本机 Agent 运行轨迹，并发送到 Creator 面板。
- 结果档案保存在本机运行轨迹旁的 `<trace>.tool-results/`，按 run ID 和 call ID 双重核对；不写入游戏资产或 Git，不提供任意文件读取。每次运行有独立档案目录。
- 面板显示压缩次数、折叠调用数、操作身份数和待验收/恢复项数；具体 operation ID 与状态在事件详情和本地轨迹内保留。
- 运行内压缩与跨 Host 恢复的会话摘要不是跨会话项目长期记忆，也不替代 Creator 操作账本；每段未压缩聊天仍受 24 条消息上限约束。

## 自动化验收与边界

在 `tools/cocos-agent-runtime/` 执行 `npm test`：TypeScript 编译、固定上游快照核验及 110 项 Node.js 测试通过。Creator Host/MCP/扩展测试另有 94 项通过。针对性回归覆盖：

- 压缩后 call ID 与 result ID 成对、operation ID 保留、`needs-preview` 仍待验收；
- 后续 `preview=passed` 清除对应的待验收状态，同时历史调用仍可追踪；
- 缺失或孤立回执被显式记为未配对，不向 Provider 发送断裂的工具调用；
- Provider 结果截断时从完整 receipt 找回 operation ID 和验收状态；
- 大型结果先归档，再由模型用当前 run 的精确 call ID 分块取回；跨 run 读取拒绝，本机文件权限和大小限制通过；
- 压缩只修改 Provider 视图，运行结果仍返回原始完整消息；
- 关键图片或未完成状态无法塞入预算时，停止 Provider 调用。
- 51 项 Creator 工具目录在默认预算下可进入首轮请求，防止固定工具合同本身触发首轮超限。
- Host 在裁剪前更新摘要、跨 state-store 重载继续携带摘要、原文用户约束片段独立于模型摘要保留；Provider 摘要失败/空响应转确定性回退，摘要不能作为授权或成功回执。

2026-10-16 Creator 2.4.15 隔离工程的长会话预验收确实超过 24 条消息并在 Creator 界面重载后恢复对话，但旧 Host 摘要把早期精确约束 `KEEP-731` 错归纳为另一标记，重载后回答了错误标记 `MINT-4827`。这证明仅持久化模型摘要不足以支持精确历史回忆。本修复已将有界用户原文片段单独保存，并加入该失败形态的自动回归；新代码包已更新到隔离工程，但 Creator 当时的 Host 未退出，无法据界面重载声称新 Host 实机通过。Creator 主进程/Host 重启后，使用新的唯一标记重复长会话与回忆测试仍待完成。

Provider 超限重试及 Creator 面板大型结果精确 call ID 取回路径仍需原生实机验收。压缩阈值与图片估算仍是配置化启发值；只对 Provider 明确标记的上下文超限执行一次重试。运行归档保留策略随本机运行记录；尚无面板清理入口。
