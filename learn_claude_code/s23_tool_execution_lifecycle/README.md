# 第 23 课：工具执行生命周期与 Hooks

**目标：** 从模型返回的 `tool_use` 追到校验、权限、实际调用和 `tool_result`，区分执行前后 Hook 对控制流和消息的影响。

## 本课要回答的问题

1. `runToolUse()` 如何解析工具名，并处理未知工具或已取消调用？
2. Schema 校验、工具级输入校验、`PreToolUse` Hook、权限决策和 `tool.call()` 按什么顺序运行？
3. Hook 拒绝、修改输入、阻止继续、异常和取消分别在哪一层收敛？
4. 成功、失败和 MCP 工具如何封装结果消息？

## 一次工具调用的主链

~~~mermaid
flowchart TD
  A[assistant tool_use] --> B[runToolUse: 查找工具 / 检查取消]
  B --> C[streamedCheckPermissionsAndCallTool]
  C --> D[inputSchema.safeParse]
  D -->|失败| X[InputValidationError tool_result]
  D -->|通过| E[tool.validateInput]
  E -->|拒绝| X
  E -->|通过| F[清理与回填输入]
  F --> G[PreToolUse Hooks]
  G -->|stop / 取消 / Hook 异常| Y[停止结果]
  G --> H[resolveHookPermissionDecision]
  H -->|deny / ask 未获允许| Z[权限拒绝 tool_result]
  H -->|allow| I[tool.call + progress]
  I -->|抛错| Q[is_error 结果 + PostToolUseFailure]
  I -->|成功| J[映射结果 / structured_output]
  J --> K{MCP 工具?}
  K -->|否| L[先加入 tool_result]
  K -->|是| M[PostToolUse 可更新输出]
  L --> N[PostToolUse 附件与上下文]
  M --> O[用最终输出加入 tool_result]
  N --> P[返回消息与 contextModifier]
  O --> P
~~~

`runToolUse()` 是单个 `tool_use` 的入口。并发安全分组和多个调用的调度由 `toolOrchestration.ts` 负责，留到第 24 课；本课从该入口进入单次调用内部。

## 入口先解决“调用哪个工具”

`runToolUse()` 先从当前可用工具表按模型给出的名称查找工具；找不到时，只对确认是废弃别名的名称回退到基础工具。仍找不到就直接生成带 `is_error: true` 的 `tool_result` 并结束。若调用开始前 abort signal 已经触发，则生成停止结果，也不会进入输入校验和 Hook。

找到工具后，入口把工作交给 `streamedCheckPermissionsAndCallTool()`。这个包装器建立一个 `Stream`：工具进度通过回调包装成 `ProgressMessage` 立即入流，异步执行完成后再把最终消息更新入流。因此进度和最终结果共用一个异步迭代接口，但不是同一种消息。

## 校验发生在 PreToolUse 之前

`checkPermissionsAndCallTool()` 先用 `tool.inputSchema.safeParse(input)` 做结构和类型校验。失败时把 Zod 错误整理成 `InputValidationError`，必要时附加“工具 Schema 未发送”的提示，然后返回错误 `tool_result`。接着调用可选的 `tool.validateInput(parsedInput.data, context)` 做工具自己的值校验；返回 `result: false` 时同样直接结束。

两层校验都通过后，执行路径才准备 Hook 和权限系统可见的输入：

- Bash 输入会剥离只应由权限系统注入的 `_simulatedSedEdit` 字段。
- 若工具定义了 `backfillObservableInput`，会在浅克隆上回填兼容或派生字段，让 Hook 和权限检查看到补全值。
- 执行用的 `callInput` 与回填克隆分开保存；如果 Hook 或权限流程没有替换输入，实际 `tool.call()` 仍使用原始字段值。Hook/权限明确返回的新输入才会汇入调用输入。

这意味着本课中的校验针对模型原始输入执行，发生在 `PreToolUse` 之前；后续 Hook 或用户确认可提供更新后的输入，执行函数会把它传到权限和调用路径。

## PreToolUse 可以改输入，也可以影响权限

`runPreToolUseHooks()` 把 `executePreToolHooks()` 的返回结果转换成执行层能处理的事件：普通消息、Hook 权限结果、更新后的输入、附加上下文、阻止继续或停止。

- `updatedInput` 若没有同时给出 `permissionBehavior`，作为 passthrough 输入继续进入通常的权限决策；若 Hook 同时返回 `allow` 或 `ask`，更新输入跟随该权限结果交给下一步。
- Hook `deny` 形成拒绝决策；Hook `ask` 会把 Hook 的理由作为 `forceDecision` 交给 `canUseTool()`。
- Hook `allow` 可以跳过交互提示，但 `resolveHookPermissionDecision()` 仍检查规则型权限；`deny` 规则仍能覆盖 Hook allow，`ask` 规则仍可能要求确认。要求用户交互的工具或 `requireCanUseTool` 上下文也会继续调用 `canUseTool()`。
- Hook 错误或等待期间的 abort 会生成 Hook 错误/取消附件并停止此调用。`preventContinuation` 则单独记录；它本身不等于拒绝当前工具，若权限允许，工具仍可执行，之后再附加停止继续的说明。

当最终权限结果不是 `allow`，执行层结束 span 并生成拒绝 `tool_result`，不会调用 `tool.call()`。权限确认 UI 和用户如何产生 allow/deny/ask 已在第 22 课说明。

## 获准后调用工具并封装成功结果

权限放行后，执行层把 `toolUseId`、`userModified`、会话上下文、`canUseTool` 和进度回调交给 `tool.call()`。工具运行中产生的进度通过前述 Stream 发送；返回值中的 `data` 是主要工具输出，其他字段还可能携带 `structured_output`、`contextModifier`、`mcpMeta` 或 `newMessages`。

成功路径会把 `data` 映射成 API `tool_result` 块，并把 `structured_output`（若存在）另存为 attachment。`addToolResult()` 再将结果块放入关联的 user message，同时携带 `tool_use_id`、来源 assistant UUID，以及适用时的反馈、额外内容块和 `contextModifier`。Agent 上下文还可按 `preserveToolUseResults` 决定是否保留额外的 `toolUseResult` 字段。

Hook 顺序对普通工具和 MCP 工具有一个重要差异：

| 工具类型 | `tool_result` 与 `PostToolUse` 的顺序 | Hook 能否更新结果 |
| --- | --- | --- |
| 普通工具 | 先加入 `tool_result`，再加入 PostToolUse 消息 | 当前执行包装器不采用 `updatedMCPToolOutput` 更新普通工具结果 |
| MCP 工具 | 先跑 PostToolUse，再把最终输出加入 `tool_result` | 可以消费 `updatedMCPToolOutput`，再将更新后的输出映射为结果块 |

PostToolUse 还可附加上下文、报告阻塞或阻止后续继续。它们通过 Hook attachment 表达，不会把已经成功返回的工具结果改成 `is_error`。Hook 自身出错会产生 `hook_error_during_execution` 附件；执行层捕获后仍保留工具调用成功结果。

## 失败路径与成功后置 Hook 不同

获准后的调用与成功结果处理区间若出现未被内部处理的异常，外层 catch 会格式化错误、生成带 `is_error: true` 的 `tool_result`，并运行 `PostToolUseFailure`。失败 Hook 可追加错误、阻塞和上下文附件；失败结果先于这些 Hook 消息返回。

输入 Schema/工具校验失败和权限未放行都在实际调用区间之前直接返回，因此不会进入这里的 `PostToolUseFailure`。这三类结果要分开读：

1. **输入无效：** `InputValidationError` 或工具校验错误，尚未执行 Hook/权限/UI 后半段。
2. **权限未放行：** `tool_result` 表示拒绝；没有实际 `tool.call()`。
3. **调用阶段异常：** `tool_result` 带 `is_error`，并追加 `PostToolUseFailure` 结果。

## 静态观察

在仓库根目录执行以下命令，只读取源码：

~~~sh
nl -ba engine/claude-code-analysis-main/src/services/tools/toolExecution.ts | sed -n '337,489p;492,577p;599,733p;754,862p'
nl -ba engine/claude-code-analysis-main/src/services/tools/toolExecution.ts | sed -n '909,1158p;1175,1223p;1271,1302p;1397,1588p;1589,1745p'
nl -ba engine/claude-code-analysis-main/src/services/tools/toolHooks.ts | sed -n '35,190p;193,319p;332,433p;435,650p'
nl -ba engine/claude-code-analysis-main/src/utils/hooks.ts | sed -n '3394,3540p'
nl -ba engine/claude-code-analysis-main/src/services/tools/toolOrchestration.ts | sed -n '19,75p;118,177p'
~~~

## 观察结果

- 执行顺序是：解析工具 → 两层输入校验 → 准备输入 → PreToolUse → 权限决策 → `tool.call()` → 结果映射 → PostToolUse 或 PostToolUseFailure。
- PreToolUse 可通过输入更新和权限结果改变后续路径；Hook allow 不会无条件越过规则型 deny/ask。
- `preventContinuation` 是继续控制信号，不等价于当前工具调用被拒绝；真正的 stop、拒绝和异常各有不同的结果分支。
- 普通工具在 PostToolUse 前提交结果，MCP 工具在 Hook 可能更新输出后再提交结果。
- 进度消息、Hook attachment、`structured_output`、`tool_result` 和 `contextModifier` 是不同载体，分别服务于流式展示、Hook 反馈、结构化数据、模型工具配对和上下文更新。

## 范围与限制

- 本课讲单次工具调用执行层；批量调用的并发/串行分组、Bash 安全语义和具体文件工具行为分别在后续专题展开。
- 只追踪 `toolHooks.ts` 对 Hook 执行结果的包装与翻译；Hook 配置发现和底层命令执行不在本课范围。
- 结论来自当前源码快照静态阅读；未运行 CLI、外部 Hook 或 MCP 工具，也未验证目标运行时行为。
