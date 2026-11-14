# 第 22 课：`canUseTool`、用户确认与权限 UI

**目标：** 追踪 `canUseTool` 如何接收权限检查结果，把需要询问的工具调用送入确认队列，再由 REPL 界面收集选择并返回给等待中的调用。

## 本课要回答的问题

1. `useCanUseTool()` 对 `allow`、`deny`、`ask` 分别怎样处理？
2. `ToolUseConfirm` 怎样把待确认请求与回调接起来？
3. REPL 如何选择当前要显示的请求，`PermissionRequest` 又如何选具体组件？
4. 用户允许、拒绝或中断后，输入、规则更新和工具调用结果怎样回传？

## 从权限结果到工具调用继续

~~~mermaid
flowchart TD
  A[工具调用请求] --> B[useCanUseTool]
  B --> C{强制决策或 hasPermissionsToUseTool}
  C -->|allow| D[构造 allow 结果并结束等待]
  C -->|deny| E[直接返回 deny]
  C -->|ask| F[生成工具说明]
  F --> G{协调器 / worker 能否处理}
  G -->|能| H[返回自动处理结果]
  G -->|不能| I[handleInteractivePermission]
  I --> J[创建 ToolUseConfirm 并加入 REPL 队列]
  J --> K[REPL 显示队首请求]
  K --> L[PermissionRequest 按工具选择 UI 组件]
  L -->|允许| M[handleUserAllow：应用规则更新、整理输入]
  M --> N[resolve allow 决策]
  L -->|拒绝 / 中断| O[cancelAndAbort]
  O --> P[resolve 拒绝或取消结果]
~~~

第 21 课讲的是 `allow`、`deny`、`ask` 如何产生；本课从这项决策交给 `useCanUseTool()` 开始。`allow` 和 `deny` 不需要弹出交互对话框；只有 `ask` 进入后续权限路由。

## `useCanUseTool()` 是决策与界面的接缝

REPL 用 `useCanUseTool(setToolUseConfirmQueue, setToolPermissionContext)` 创建 `canUseTool`，并把它交给工具调用路径。回调接收工具、输入、会话上下文、assistant 消息和 `toolUseID`，返回一个等待中的 Promise。若调用方提供 `forceDecision`，就使用该结果；否则调用 `hasPermissionsToUseTool()`。

结果分支很清楚：

- `allow`：记录决策并构造 allow 结果，带上更新后的输入和决策原因，Promise 立即结束。
- `deny`：记录拒绝后直接返回结果，不创建 UI 请求。
- `ask`：计算显示说明，再尝试协调器、swarm worker 和可用的自动检查；都未处理时进入 `handleInteractivePermission()`。

交互处理器本身不返回 Promise。它把回调放进请求队列；用户、PermissionRequest Hook、桥接端或其他已启用的处理路径之一完成后，才调用外层 `resolve()`。`createResolveOnce()` 的 `claim()` 让竞速中的多个处理路径只有一个能完成请求。

## 确认队列保存请求和完成回调

`ToolUseConfirm` 把 assistant 消息、工具、说明、输入、上下文、工具调用 ID、权限结果和回调组成一个待确认项。主要回调包括：

- `onAllow(updatedInput, permissionUpdates, feedback, contentBlocks)`：提交允许结果、用户改过的输入及可选规则更新。
- `onReject(feedback, contentBlocks)`：提交拒绝与反馈。
- `onAbort()`：中断等待中的调用。
- `recheckPermission()`：重新评估权限；如果当前上下文已变成允许，就移除队列项并恢复调用。
- `onUserInteraction()`：标记用户已开始操作，避免可选的后台自动检查在用户操作时抢先批准。

`PermissionContext` 把这些回调连到 React 队列 setter：追加请求、按 `toolUseID` 删除请求或更新请求。交互处理器也可能同时启动 PermissionRequest Hook、分类器、Claude.ai bridge 或已启用的 channel 响应；谁先完成，就先决定该次请求。Bridge/channel 是可选路径，本地队列仍承接 REPL 的交互界面。

## REPL 展示队首，再按工具分发组件

REPL 用 `toolUseConfirmQueue` 保存待确认项。焦点对话框逻辑在允许显示交互对话框且队列非空时选择 `tool-permission`；对应 overlay 只渲染 `toolUseConfirmQueue[0]`。`onDone` 从队列移除队首，请求 ID 也用于组件 key，避免相邻请求复用旧界面状态。

`PermissionRequest.tsx` 根据工具实例路由到专用组件，例如 Bash、文件写入、文件编辑、PowerShell 或 AskUserQuestion；没有专用组件时使用 `FallbackPermissionRequest`。通用权限规则在进入该组件前已评估；组件按工具类型展示输入、差异或风险说明，并调用队列项给出的回调。

Fallback 组件展示 Yes、No；允许展示永久选项时，还会提供 “Yes, and don't ask again”。这个选项提交 `localSettings` 的 allow 规则。托管策略禁止用户自定义规则时，`shouldShowAlwaysAllowOptions()` 会隐藏该项。专用组件可像 Fallback 一样提交规则更新，也可以提交修改后的输入、反馈或内容块。

## 用户选择如何回到调用方

允许路径由 `PermissionContext.handleUserAllow()` 收尾：先持久化 `permissionUpdates`，再把更新应用到当前 `ToolPermissionContext`，记录决策，最后生成 `behavior: 'allow'`。返回结果保留 `updatedInput`，并可携带 `userModified`、反馈和内容块；等待中的工具调用随后继续。

用户拒绝路径由 `onReject()` 调用 `cancelAndAbort()` 并解析外层 Promise。这个 helper 返回带拒绝消息的 `behavior: 'ask'` 结果；主交互会话在没有反馈时可以中止当前请求，有反馈时则把反馈放进结果供上层消费。显式中断总会走 abort。配置规则命中时，`deny` 已在第 21 课的规则检查路径中返回；用户选择 No 或中断则记录为交互拒绝/取消，来源与取消语义各自独立。

## 静态观察

在仓库根目录执行以下命令，只读取源码：

~~~sh
nl -ba AI/claude-code-analysis-main/src/hooks/useCanUseTool.tsx | sed -n '27,183p'
nl -ba AI/claude-code-analysis-main/src/hooks/toolPermission/PermissionContext.ts | sed -n '96,173p;216,347p;357,379p'
nl -ba AI/claude-code-analysis-main/src/hooks/toolPermission/handlers/interactiveHandler.ts | sed -n '34,232p;234,298p;300,430p;433,536p'
nl -ba AI/claude-code-analysis-main/src/hooks/toolPermission/handlers/coordinatorHandler.ts | sed -n '1,180p'
nl -ba AI/claude-code-analysis-main/src/hooks/toolPermission/handlers/swarmWorkerHandler.ts | sed -n '1,160p'
nl -ba AI/claude-code-analysis-main/src/components/permissions/PermissionRequest.tsx | sed -n '47,127p;146,216p'
nl -ba AI/claude-code-analysis-main/src/components/permissions/FallbackPermissionRequest.tsx | sed -n '15,140p;150,205p;294,305p'
nl -ba AI/claude-code-analysis-main/src/screens/REPL.tsx | sed -n '1101,1136p;2024,2035p;2382,2388p;4519,4525p'
~~~

## 观察结果

- 权限检查只返回结果；`useCanUseTool()` 决定直接结束，还是为 `ask` 建立等待中的交互。
- 队列项通过 ID 和回调连接权限请求、REPL 状态及 UI；REPL 仅呈现队首。
- UI 组件可提交输入更改和 PermissionUpdate；中央上下文负责应用/持久化更新并构造最终决策。
- Hook、自动检查和远端响应可与本地 UI 并行；resolve-once 约束确保一个请求只完成一次。

## 范围与限制

- 本课覆盖主 REPL 中的权限确认路径；不展开第 21 课的规则评估，也不展开第 23 课的工具执行/结果回灌。
- 各工具的选项、差异预览和输入修改逻辑由专用权限组件决定；本课只用 Fallback 说明共同回调契约。
- 结论来自当前源码快照静态阅读；未在 CLI 中触发真实权限弹窗，也未验证 bridge/channel 的远端响应。
