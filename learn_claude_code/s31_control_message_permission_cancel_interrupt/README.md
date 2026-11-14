# 第 31 课：控制消息协议：权限请求、取消与中断

**目标：** 沿 SDK/Remote 控制消息追踪一次工具权限等待，分清请求应答、取消待处理权限请求与中断当前 turn 的不同语义。

## 本课要回答的问题

1. 普通 user 消息与 `control_request`、`control_response` 如何分流？
2. `StructuredIO` 怎样用 `request_id` 把异步权限请求和回应配对？
3. `can_use_tool` 何时直接决策，何时让 PermissionRequest Hook 与外部 UI 竞速？
4. `control_cancel_request` 和 `interrupt` 分别取消什么？
5. Remote 会话如何把远程权限请求呈现在本地 UI，并把结果送回去？

## 先看消息外壳

`controlSchemas.ts` 将请求定义为 `{ type: 'control_request', request_id, request }`，响应则为 `{ type: 'control_response', response: { subtype, request_id, ... } }`；取消已有请求另用 `{ type: 'control_cancel_request', request_id }`。`request_id` 关联一次请求和回应，`tool_use_id` 标识被询问权限的工具调用，两者用途不同。

`StructuredIO` 按换行解析 JSON 输入。`user` 消息进入 Print 命令队列；`control_request` 交给 Print 的控制分支；`control_response` 在 `processLine()` 中直接解析并尝试完成待处理 Promise，通常不会再交到 turn 队列。它的 `outbound` 是共享 FIFO，模型流消息和 `sendRequest()` 发出的控制请求通过同一个输出序列发送。

~~~mermaid
sequenceDiagram
  participant Q as Query/Tool
  participant S as StructuredIO
  participant H as SDK Host
  Q->>S: createCanUseTool(tool,input,signal)
  S->>H: control_request(can_use_tool, request_id)
  Note over S: pendingRequests[request_id] 等待回应
  H->>S: control_response(request_id, allow/deny)
  S->>Q: 解析回应并返回 PermissionDecision
  Note over Q,H: signal 中止时，S 发 control_cancel_request，立即拒绝等待 Promise
~~~

## Headless/SDK 权限往返

`print.ts` 在 SDK URL 或选择 `stdio` 权限提示时，将 `structuredIO` 交给 `getCanUseToolFn()`。`StructuredIO.createCanUseTool()` 先执行已有权限规则：结果为 allow/deny 时直接返回；结果为 ask 时，同时启动 PermissionRequest Hook 与宿主权限请求。Hook 若先作出决定，就中止尚未完成的宿主请求；宿主先回应时，响应会转换成 Query 可用的权限决策。

`sendRequest()` 先检查输入流与 abort signal，再把带 `request_id` 的请求加入输出 FIFO，并在 `pendingRequests` 登记 resolve/reject/schema。输入端收到对应 `control_response` 后，按 ID 取出等待项：error 以异常拒绝，success 的 payload 通过请求所带 schema 检查后 resolve。响应到达前若 abort，StructuredIO 发出 `control_cancel_request`，立即拒绝 Promise；关闭输入流也会拒绝仍在等待的请求。

迟到或重复响应有专门处理：已完成的 `tool_use_id` 会放进有上限的集合；重连后重复到达的 permission response 不会再次回灌工具调用。找不到 pending request 的响应可交给 `unexpectedResponseCallback`，供 Print 的 orphaned-permission 恢复路径处理。这里的 request ID 配对、去重与恢复都发生在 Query 之外。

## 控制引擎自身的请求

协议也是双向的。SDK Host 可以向 Print stdin 发送 `control_request`。Print 消息循环对 `interrupt` 中止当前 Query 并回 success；对 `end_session` 中止当前 Query、回 success 后退出输入循环并收尾。`initialize`、`set_permission_mode`、`set_model` 等请求更新会话配置并按各自分支回应。它们是会话控制，不是用户 prompt，也不会当作新一轮 user 消息排入 Query。

要分开两类取消：

| 消息 | 发起方与对象 | 结果 |
| --- | --- | --- |
| `control_cancel_request` | 请求接收端要求取消一个带 `request_id` 的待处理控制请求，常见于权限等待被 Hook 或远端竞争者先解决 | 清除权限对话或取消回调；不代表结束整个 turn |
| `control_request` / `interrupt` | 宿主要求正在执行的会话中断当前 turn | Abort 当前 Query；Print 仍可回应并继续会话 |
| `control_request` / `end_session` | 宿主要求结束 headless 会话 | Abort 当前工作、确认请求、停止读取新输入并进入进程收尾 |

## Remote UI 的权限往返

Remote 会话不经过本地 `StructuredIO` 的 pending map。远端通过 WebSocket 发来 `can_use_tool` 控制请求后，`RemoteSessionManager` 把 `{request_id, request}` 放入自己的 `pendingPermissionRequests`，再通知 `useRemoteSession` 创建权限确认项。UI 的 allow/reject/abort 回调调用 `respondToPermissionRequest()`；Manager 删除 pending 项并通过 WebSocket 回送以原 `request_id` 配对的 `control_response`。

远端的 `control_cancel_request` 由 Manager 删除 pending 权限请求并通知 UI 收起对话框。用户在 Remote 会话中按取消，则 UI 调用 `cancelSession()`，WebSocket 发送一个新的 `control_request`，subtype 为 `interrupt`。因此“撤回一个权限弹窗”和“中断远端当前 turn”在入口、消息类型和状态影响上都不同。

## 静态观察

以下命令只读取源码：

~~~sh
nl -ba AI/claude-code-analysis-main/src/entrypoints/sdk/controlSchemas.ts | sed -n '53,145p;578,619p'
nl -ba AI/claude-code-analysis-main/src/cli/structuredIO.ts | sed -n '135,162p;333,456p;465,531p;533,658p'
nl -ba AI/claude-code-analysis-main/src/cli/print.ts | sed -n '802,832p;2736,2762p;2813,2960p'
nl -ba AI/claude-code-analysis-main/src/remote/RemoteSessionManager.ts | sed -n '143,212p;247,297p'
nl -ba AI/claude-code-analysis-main/src/hooks/useRemoteSession.ts | sed -n '330,416p;568,583p'
nl -ba AI/claude-code-analysis-main/src/remote/SessionsWebSocket.ts | sed -n '325,357p'
~~~

## 观察结果

- `control_response` 按 `request_id` 完成待处理请求，`tool_use_id` 用于识别权限对应的工具调用；不要把它们当作同一个 ID。
- `control_cancel_request` 取消一个等待中的控制请求，`interrupt` 中断当前 Query turn，`end_session` 还会结束输入循环。
- SDK 权限决策先经过本地规则；进入 ask 后，PermissionRequest Hook 可与宿主 UI 并行竞速。
- Print/SDK 和 Remote UI 使用相似的消息合同，但分别由 `StructuredIO` 与 `RemoteSessionManager` 持有 pending 请求。

## 范围与限制

- 结论来自当前快照的 schema、stdio 处理和 Remote 客户端静态代码；没有连接 SDK Host、Remote 服务或实机验证协议交互。
- 本课跟踪代表性控制类型，不逐一展开 `controlSchemas.ts` 中所有 MCP、Hook、设置与会话管理操作。
- `agentSdkTypes.ts` 中部分公开 SDK 函数仍为未实现桩；本课描述的是实际存在的 `StructuredIO` 与 Remote UI 接线。