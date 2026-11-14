# 第 19 课：Token 预算与上下文压缩

**目标：** 分清模型上下文窗口、用户指定的整轮输出 token 目标和单次响应输出上限；追踪 Query 如何在请求前压缩历史、在压缩后继续请求，以及在 413 或输出截断后恢复。

## 本课要回答的问题

1. Query 用什么 token 估算触发自动压缩？
2. 自动压缩前后，消息数组和 Query 状态怎样变化？
3. `TOKEN_BUDGET` 怎样追加模型续跑提示，它和上下文压缩有什么不同？
4. 上下文过长与单次输出到顶，各自走什么恢复路径？

## 先分清三类 token 限制

| 限制 | 计量对象 | 触发后的动作 | 入口 |
| --- | --- | --- | --- |
| 上下文窗口 | 当前模型请求携带的上下文大小 | 请求前整理或压缩历史；接近硬限制时阻止发送 | `autoCompact.ts`、`query.ts` |
| 整轮输出 token 目标 | 本轮累计生成的 output tokens | 低于目标的 90% 时加入续跑提示；达到目标或收益变小时结束 | `query/tokenBudget.ts`、`bootstrap/state.ts` |
| 单次响应输出上限 | 一次 assistant 响应的 `max_output_tokens` | 有条件地提高本次上限，或用续写提示再发模型请求 | `query.ts` 的 `max_output_tokens` 恢复分支 |

`QueryParams.taskBudget` 还是另一种 API 级整轮预算。它和本地 `TOKEN_BUDGET` 不同：Query 在压缩历史后会把压缩前最终上下文的消耗扣进 `taskBudgetRemaining`，避免服务端只看见摘要而漏算已用预算。本课不展开 API 侧预算协议。

~~~mermaid
flowchart TD
  A[进入 Query 循环] --> B[准备 messagesForQuery]
  B --> C[工具结果预算与可选历史整理]
  C --> D[计算上下文 token 估值]
  D --> E{达到自动压缩阈值?}
  E -- 否 --> F{达到阻止请求的硬限制?}
  F -- 是 --> G[返回 blocking_limit]
  F -- 否 --> H[请求模型]
  E -- 是 --> I[生成压缩摘要与恢复附件]
  I --> J[用边界、摘要、保留消息和附件替换请求历史]
  J --> H
  H --> K{上下文 413?}
  K -- 是 --> L[先尝试折叠恢复，再尝试一次 reactive compact]
  L --> M{恢复成功?}
  M -- 是 --> J
  M -- 否 --> N[返回 prompt_too_long]
  H --> O{正常完成且无工具续跑?}
  O -- 是 --> P{TOKEN_BUDGET 未到 90%?}
  P -- 是 --> Q[加入 meta 续跑提示并回到 Query 循环]
  P -- 否 --> R[完成]
~~~

## 上下文 token 估值与自动压缩阈值

`tokenCountWithEstimation()` 不把历史上每次 API 使用量累计相加。它取最近一次带 usage 的模型响应所报告的 input、output 和 cache tokens，再粗略估计其后的新消息；这样并行工具结果不会被重复计入旧的完整上下文。若前序 history snip 已移除消息，Query 还把 `snipTokensFreed` 传给 auto compact 修正估值，因为保留下来的 assistant usage 仍反映 snip 前的请求。

`getEffectiveContextWindowSize(model)` 先读取该模型上下文窗口；如果设置了有效的 `CLAUDE_CODE_AUTO_COMPACT_WINDOW`，取两者较小值，然后再扣除摘要输出预留（模型最大输出与 20,000 tokens 的较小值）。默认自动压缩阈值是在此基础上再留 13,000 tokens。`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` 可把阈值进一步调低，但不会高于默认阈值。因此阈值随模型和环境变化，不是固定百分比。

可以把默认计算读成三步：

~~~text
effectiveWindow = min(modelContextWindow, configuredAutoCompactWindow)
                  - min(modelMaxOutputTokens, 20,000)
autoCompactThreshold = effectiveWindow - 13,000
blockingLimit = effectiveWindow - 3,000
~~~

环境值缺省或无效时使用模型窗口；硬限制也允许测试专用的环境覆盖。

Query 入口处的硬限制是有效上下文窗口减去 3,000 tokens，除非测试覆盖值被设置。只有在未压缩、不是 `compact` / `session_memory` 请求，且其他上下文管理模式没有接管时，Query 才在调用模型前检查并返回 `blocking_limit`。自动压缩关闭时，Query 仍有独立的硬限制判断。

## 每次模型请求前的准备次序

Query 每轮先从最近的 compact boundary 之后取得消息，再按以下次序准备请求：

1. 对特大工具结果应用单条结果预算，可替换过大的结果内容。
2. 若启用 history snip，裁剪部分旧历史并记录估算释放量。
3. 调用 microcompact，处理可压缩的工具/缓存上下文。
4. 若 Context Collapse 已启用，先应用已提交的折叠视图。
5. 调用 `autoCompactIfNeeded()` 判断是否需要完整摘要压缩。

前四步不是同一种压缩。当前 `microcompactMessages()` 先检查基于间隔时间的工具结果清理；否则仅在 feature、模型和主线程条件都允许时走 cache-editing 路径，有些构建和 query source 下它会直接 no-op。Query 再按 gate 调用 snip 与 Context Collapse，之后才检查完整自动压缩；较轻的整理若已把估值降到阈值以下，就可以保留更细的上下文，而不立刻把历史改成一段摘要。

`autoCompactIfNeeded()` 会跳过禁用状态和若干特殊 query source。达到阈值后，当前源码先尝试 session-memory compact；没有结果时再调用 `compactConversation()`。连续失败会写回 `AutoCompactTrackingState`；达到 3 次后，本会话后续 Query 轮次跳过自动压缩尝试，避免对不可恢复的超长上下文反复发摘要请求。

## 压缩结果怎样回到模型请求

`compactConversation()` 生成摘要，并构造 `CompactionResult`。Query 用 `buildPostCompactMessages()` 按固定次序组装新的历史：

1. compact boundary marker；
2. 摘要消息；
3. 明确保留的原消息（若有）；
4. 恢复文件、Plan、Skill、工具等上下文的附件；
5. Hook 结果。

Query yield 这些新消息供上层记录和显示，然后把 `messagesForQuery` 替换为压缩后数组，继续当前 Query 调用并请求模型。成功时，压缩跟踪状态重置；若有 API `taskBudget`，则把压缩前最后一个上下文窗口的消耗从剩余预算扣除。

这说明自动压缩是模型请求前的状态转换，不是用户回合的终止结果。Query 的消息历史被替换，但同一个 Query 流程会用新历史继续工作。

## 413 上下文错误与输出上限恢复

如果模型请求返回 prompt-too-long（413），Query 会先暂存错误，不立即把失败消息交给调用方。若 Context Collapse 有可提交的待处理折叠，先排空折叠并重试；否则在对应 feature 可用时调用 reactive compact，成功后用压缩后的消息构造新 Query 状态再试一次。恢复不可用或已失败时，才 yield 错误并返回 `prompt_too_long`。恢复次数有 guard，防止紧接着的错误进入无限重试。

`max_output_tokens` 是单次 assistant 输出到顶，不是上下文塞不下：错误同样先暂存。特定 gate 开启且没有显式输出上限覆盖时，Query 可将默认 8K cap 升到 64K 对同一历史再试；若仍然到顶，则最多注入 3 次“继续工作”的 meta 提示。它不压缩历史，也不等同于整轮 `TOKEN_BUDGET`。

## `TOKEN_BUDGET`：本轮输出没达到目标时续跑

REPL 在回合开始时从输入解析 token 目标（例如 `+500k` 或 `use 2M tokens`），并在 `bootstrap/state.ts` 记录本轮起点的累计 output tokens。Query 只在模型正常结束、没有待执行工具 follow-up 时检查预算：

- `budget` 为空、非正数或当前 Query 属于 agent 时，预算检查直接停止，不自动续跑。
- 若当前整轮 output tokens 还不到目标的 90%，`checkTokenBudget()` 生成续跑提示。Query 保留已有消息，追加一条 meta user message，再次进入 Query 循环；这不是 compact，也不会增加 `turnCount`。
- 达到目标后结束。连续续跑至少 3 次后，如果最近两段新增量都小于 500 tokens，则按收益递减提前停止。

因此 `TOKEN_BUDGET` 衡量一轮工作产出了多少；自动压缩衡量的是下一次请求的上下文是否接近模型窗口。一个可能触发“继续做”，另一个负责“腾出输入空间”。

## 静态观察

在仓库根目录执行以下命令，只读取源码：

~~~sh
nl -ba AI/claude-code-analysis-main/src/query/tokenBudget.ts | sed -n '1,93p'
nl -ba AI/claude-code-analysis-main/src/utils/tokenBudget.ts | sed -n '1,28p;66,74p'
nl -ba AI/claude-code-analysis-main/src/bootstrap/state.ts | sed -n '704,743p'
nl -ba AI/claude-code-analysis-main/src/screens/REPL.tsx | sed -n '2890,2898p'
nl -ba AI/claude-code-analysis-main/src/utils/tokens.ts | sed -n '205,258p'
nl -ba AI/claude-code-analysis-main/src/services/compact/autoCompact.ts | sed -n '28,145p;147,158p;160,239p;241,350p'
nl -ba AI/claude-code-analysis-main/src/services/compact/microCompact.ts | sed -n '253,293p;402,530p'
nl -ba AI/claude-code-analysis-main/src/services/compact/compact.ts | sed -n '299,338p;387,430p;596,748p'
nl -ba AI/claude-code-analysis-main/src/query.ts | sed -n '164,178p;193,197p;268,291p;365,468p;470,550p;628,648p;1062,1184p;1185,1255p;1308,1358p'
~~~

## 观察结果

- 自动压缩阈值从模型上下文窗口、摘要输出预留和缓冲量计算；Query 还在请求前有独立硬限制保护。
- Query 先应用轻量上下文整理，再判断是否需要摘要压缩；压缩成功后替换历史并在当前 Query 流程内继续请求。
- 整轮 `TOKEN_BUDGET` 用累计 output tokens 决定是否追加续跑提示，不管理输入上下文大小。
- 413 恢复和 `max_output_tokens` 恢复作用对象不同：前者腾输入空间，后者处理单次响应输出被截断。

## 简化与限制

- 本课只跟读 Query 主循环中的预算和压缩接线，不展开 history snip、Context Collapse、session memory 或所有 feature gate 的内部算法。
- 当前展开的源码树中没有 `snipCompact.ts`、`contextCollapse/index.ts` 和 `reactiveCompact.ts` 实现文件；本课只描述 Query 对这些可选模块的调用和可见恢复分支。
- 结论来自静态源码阅读；没有运行 CLI、触发真实 413 或观测模型 token 计数，因此不构成运行时验证。
