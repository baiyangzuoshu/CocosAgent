# 第 40 课：Bridge 权限请求的双端竞速与收敛

**目标：** 从本地 `canUseTool` 权限检查跟到 Bridge 回调，说明一个工具权限请求如何同时等待终端用户和 claude.ai 用户，以及代码怎样让第一个有效决定生效并清理另一路。

## 本课要回答的问题

1. 哪些 ask 决策会把工具权限送到 CCR？远端请求携带哪些字段？
2. `control_response` 如何凭 `request_id` 找到等待中的本地处理器？
3. 本地确认、CCR 回应、Hook、classifier 等路径同时竞争时，怎样防止重复 resolve？
4. 哪一侧胜出后，pending handler、本地确认项和远端提示分别怎样收尾？
5. `isBridgePermissionResponse` 能证明哪些字段有效，不能证明什么？

## 从权限 ask 进入双端确认

`useCanUseTool.tsx` 在权限决策需要交互时调用 `handleInteractivePermission()`，并只在 `BRIDGE_MODE` 开启时传入 AppState 中的 Bridge 回调。进入交互处理器后，本地 `ToolUseConfirm` 仍会先进入确认队列；若存在 Bridge 回调，处理器另外生成 `bridgeRequestId`，向 CCR 发起权限请求并订阅同 ID 的响应。

~~~mermaid
flowchart LR
  A[useCanUseTool: ask] --> B[handleInteractivePermission]
  B --> C[本地确认队列]
  B --> D[Bridge sendRequest]
  D --> E[CCR can_use_tool]
  E --> F[control_response]
  F --> G[按 request_id 查找回调]
  C --> H{claim 一次性竞争}
  G --> H
  H --> I[本地或远端决定生效]
  I --> J[resolve 权限结果并清理另一侧]
~~~

这里的两个等待点并非两次串行批准。它们是同一个 ask 决策的两个可竞争入口：任一侧先取得 `claim()` 即可结束等待，其他回调随后看到已认领状态并退出。

## 请求、关联与回调合同

`BridgePermissionCallbacks` 把 UI/权限模块需要的四个动作抽象为 `sendRequest`、`sendResponse`、`cancelRequest` 和 `onResponse`。`useReplBridge.tsx` 提供具体实现：请求被编码成 `control_request`，`request.subtype` 为 `can_use_tool`；消息包含 `tool_name`、当前输入、`tool_use_id`、描述，以及存在时的权限建议和被阻止路径。它用 `request_id` 作为 Map key 注册等待中的处理器，`onResponse()` 返回的函数会删除这条注册。

入站消息在 `bridgeMessaging.ts` 被识别为 `control_response` 后，交给 `onPermissionResponse`，而不是作为普通 SDK 消息继续处理。REPL hook 从外层 response 取 `request_id`，查 Map、先删除匹配项，再要求外层 subtype 是 `success` 且内层 response 通过 `isBridgePermissionResponse`，才调用等待处理器。

这个顺序带来一个重要边界：若收到 error subtype、缺少内层 response 或判别字段无效，pending Map 项已经删除，但 handler 不会收到结果；这段代码没有为这些情况补发拒绝结果或重新注册 handler。终端确认仍可作为另一条处理路径，但不能把无效响应描述成自动拒绝。

响应类型的必要判别字段是 `behavior: 'allow' | 'deny'`。类型守卫只检查对象和这个判别值；它没有深度校验 `updatedInput`、`updatedPermissions`、`message` 的内部结构，也不验证请求身份以外的策略条件。不要把这个守卫描述成完整 schema 校验。

## 一次性竞争与胜出后的处理

`createResolveOnce()` 同时维护 `claimed` 和 `delivered`。`claim()` 以同步的检查并标记返回胜负；各竞争回调在执行副作用前先 claim。`resolve()` 再确保底层 Promise 只交付一次。这覆盖本地确认、Bridge 回应、权限 Hook、classifier、权限重检查，以及启用时的 channel 回应等路径。

| 胜出路径 | 本地权限结果 | 对 Bridge 的收尾 |
| --- | --- | --- |
| CCR 返回 `allow` | 可持久化非空 `updatedPermissions`；用 `updatedInput` 或原展示输入构造 allow 结果 | Map 项已在分发前删除，回调移除 abort listener 并关闭本地确认项 |
| CCR 返回 `deny` | 记录拒绝并以返回的 `message` 取消工具执行 | 与远端 allow 使用同一回调清理路径 |
| 本地允许、拒绝或 abort | 由本地交互结果完成权限 Promise | 发送 `control_response`；随后发 `control_cancel_request` 以结束远端待处理提示 |
| Hook、classifier 或权限重检查先解决 | 按各自策略结果完成权限 Promise | 取消 Bridge pending 请求，避免另一侧继续等待 |

若本地 abort signal 先触发，`onResponse()` 返回的 unsubscribe 会从 pending Map 删除对应项；收到有效远端响应时，回调会移除该 abort listener。需要留意，本地 onAllow/onReject/onAbort、Hook、classifier 和权限重检查分支调用的是 `sendResponse` 和/或 `cancelRequest`，并未直接调用注册时返回的 unsubscribe。源码没有证明取消写入一定会带来及时回包，所以不要推断本地 winner 当场就删除了 Map 项；Map 删除可由后续匹配响应或 abort unsubscribe 完成。对于每个 ask，Map 的注册与删除都使用同一个 `request_id`。发送函数通过 `transport.write()` fire-and-forget；源码调用不等于远端已确认收到。

## 与相邻课程的边界

- 第22课讲本地 `canUseTool` 与确认 UI；本课只追踪本地 ask 如何接入 Bridge，并与 CCR 决策竞争。
- 第31课讲一般 `control_response`、`request_id` 和取消协议；本课聚焦 Bridge hook 持有的 pending handler Map 及其交给权限处理器的内容。
- 第37课讲服务端发起控制请求后的响应策略；本课是 CLI 发出 `can_use_tool` 请求，并等待服务端用户的权限决定。
- 第39课讲权限请求对应的 worker 状态变化；本课讲本地决策竞速与回调清理，不重新推导 `requires_action` 状态映射。

## 静态观察

以下命令只读取当前源码快照：

~~~sh
nl -ba engine/claude-code-analysis-main/src/hooks/useCanUseTool.tsx | sed -n '155,168p'
nl -ba engine/claude-code-analysis-main/src/hooks/toolPermission/handlers/interactiveHandler.ts | sed -n '63,95p;130,230p;234,298p'
nl -ba engine/claude-code-analysis-main/src/hooks/toolPermission/PermissionContext.ts | sed -n '63,94p'
nl -ba engine/claude-code-analysis-main/src/bridge/bridgePermissionCallbacks.ts | sed -n '1,43p'
nl -ba engine/claude-code-analysis-main/src/hooks/useReplBridge.tsx | sed -n '367,391p;538,585p'
nl -ba engine/claude-code-analysis-main/src/bridge/bridgeMessaging.ts | sed -n '132,154p'
~~~

## 观察结果

- Bridge 只接入已经进入交互处理器的 ask；本地确认队列仍然建立，因此本地和远端确认可同时等待。
- `request_id` 将出站 `can_use_tool`、pending handler 和回来的 `control_response` 对齐；`tool_use_id` 另行标识工具调用。
- `claim()` 决定哪一方有权完成权限 Promise；响应内容只有 `allow` 或 `deny` 的分支判别得到轻量类型守卫支持。
- 本地确认赢时回应并取消远端请求；Hook、classifier、权限重检查等本地自动路径会取消远端等待。注册 disposer 并未在这些 winner 分支直接调用，pending Map 的及时收尾不能仅从取消调用推断。

## 范围与限制

- 结论来自仓库当前 Claude Code 源码快照的静态阅读；没有连接 CCR、使用 claude.ai 确认权限或验证 WebSocket 写入结果。
- 本课讨论具有 `BRIDGE_MODE` 权限回调的交互式 REPL 路径；不外推到 SDK、Print、RemoteSessionManager 或其他无 Bridge 回调的执行模式。
- `sendRequest`、`sendResponse` 和 `cancelRequest` 的调用可在源码中确认，但本课没有测量它们在网络错误、服务端超时、断线重连或迟到响应时的实际表现。
