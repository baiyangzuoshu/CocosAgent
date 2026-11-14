# 第 37 课：Bridge 服务端控制请求与响应策略

**目标：** 从入站的 `control_request` callback 跟到 Bridge 的响应构造，理解本地副作用、策略拒绝、`outboundOnly` 和 `request_id` 如何组合。

## 本课要回答的问题

1. `handleIngressMessage()` 把 `control_request` 交给哪个处理层？
2. Bridge 支持哪些 subtype，它们分别修改本地状态还是只回应能力信息？
3. `set_permission_mode` 为什么由调用方返回策略 verdict，而不是 helper 直接修改权限模式？
4. `outboundOnly` 如何限制可变控制请求？为什么仍要成功回应 `initialize`？
5. 哪些路径可能没有 transport 或 callback，响应层如何处理？

## 从分流 callback 到响应事件

第36课停在 `handleIngressMessage()` 将 `control_request` 交给 callback。本课继续跟 callback：env-based `replBridge.ts` 创建闭包，捕获当前 transport 与 session ID；env-less `remoteBridgeCore.ts` 在 data callback 中调用同一个 `handleServerControlRequest()`，并额外传入 `outboundOnly`。

~~~mermaid
flowchart TD
  A[入站 control_request] --> B[onServerControlRequest callback]
  B --> C{transport 存在?}
  C -->|否| D[记录日志并返回，不生成响应]
  C -->|是| E{outboundOnly 且 subtype 非 initialize?}
  E -->|是| F[统一生成 error 响应]
  E -->|否| G{subtype 分派}
  G -->|initialize| H[返回最小 capabilities]
  G -->|set_model / set_max_thinking_tokens| I[调用可选状态 callback，再 success]
  G -->|interrupt| J[调用可选中断 callback，再 success]
  G -->|set_permission_mode| K[请求调用方策略 verdict]
  G -->|其他| L[返回 unsupported error]
  H --> M[附加 session_id，transport.write]
  I --> M
  J --> M
  K --> M
  L --> M
  F --> M
~~~

helper 先检查 transport。若它为 `null`，代码只记录“无法回应”的调试日志并返回。否则先检查 `outboundOnly`：除 `initialize` 外的请求都在进入 subtype switch 前统一收到 error，避免远端 UI 将没有本地执行效果的操作显示为成功。这个分支也覆盖未知 subtype，因此它们收到的是 outbound-only 错误，而非 switch 的 unsupported 错误。

正常模式下，`initialize` 返回最小 capability payload：空 commands/models/account、normal output style 和当前进程 PID。模型设置、思考 token 设置和 `interrupt` 则先调用各自可选 callback，再返回 success。helper 不负责实际状态实现；状态副作用属于注入的 REPL callback。

| subtype | 本地动作 | helper 的响应 |
| --- | --- | --- |
| `initialize` | 无；提供最小能力信息 | success，附带 capability payload |
| `set_model` | 调用可选 `onSetModel(model)` | success |
| `set_max_thinking_tokens` | 调用可选 `onSetMaxThinkingTokens(value)` | success |
| `interrupt` | 调用可选 `onInterrupt()` | success |
| `set_permission_mode` | 请求 `onSetPermissionMode(mode)` 返回 `{ok:true}` 或 `{ok:false,error}` | 按 verdict 返回 success 或 error |
| 其他 subtype | 不执行本地动作 | error，说明该 subtype 未处理 |

响应沿用原请求的 `request_id`，之后在外层加上当前 `session_id`，最后调用 `transport.write()`。该调用被 `void` 丢弃，helper 不等待传输 Promise 完成；源码能证明响应事件被提交给 transport，不能证明服务端已确认收到。

## 权限模式由调用方守策略

`bridgeMessaging.ts` 不直接导入 auto/bypass 的策略依赖。它只读取 `onSetPermissionMode` 的 verdict：callback 缺失时默认返回 error，避免谎报成功。正常 REPL 的 callback 在 `useReplBridge.tsx`：先检查 bypass 是否被配置禁用、会话是否以危险跳过权限参数启动；启用 auto 模式时还会检查 feature gate。通过后才用 `transitionPermissionMode()` 更新 AppState，并让排队中的权限项重新检查。

这些 guard 放在 callback 前端，而不是由 helper 复制策略规则。源码注释说明，某些 transition guard 会抛错且带副作用；若异常逃出，就可能既没有正确状态也没有 `control_response`，服务端会等待到连接超时。因此 callback 通过明确的 verdict 把策略拒绝转换成协议级 error。

注意几个 subtype 的缺省行为并不完全一致：`set_model`、思考 token 和 `interrupt` 即使 callback 未注入，也会继续返回 success；只有 `set_permission_mode` 明确把 callback 缺失视作 error。调用方应提供对应实现，helper 本身不会验证这些 success 是否真的改变了本地状态。

## outbound-only 是两层边界

`initReplBridge()` 在 env-less gate 开启且不是 perpetual 模式时，转到 `initEnvLessBridgeCore()` 并传递 `outboundOnly`。env-less core 将该值传给 v2 transport 和控制请求 helper。transport 的 outbound-only 模式跳过 SSE read stream，只保留 CCR 写路径；helper 同时保留“除 initialize 外都拒绝”的响应策略，避免任何到达处理器的可变请求被 false-success。

`initialize` 是例外：helper 会成功回应，因为其注释指出不回应会导致服务端关闭 WebSocket。transport 不读 SSE 时，通常没有入站控制帧可触发这条逻辑；“读取流关闭”和“handler 对请求作出拒绝”是两个不同层次，不能混为同一个开关。

## 与相邻课程的边界

- 第31课讲通用控制协议、权限等待与取消；本课聚焦 Bridge 收到服务端 `control_request` 后的 subtype 到响应映射。
- 第36课讲消息解析和分流；本课从已经被识别的 `control_request` 开始，不重讲 UUID 去重。
- 第35课讲环境注册、work poll 和重连；本课只比较 env-based 与 env-less core 的 handler 接线，不重讲 session 生命周期。

## 静态观察

以下命令只读取当前源码快照：

~~~sh
nl -ba AI/claude-code-analysis-main/src/bridge/bridgeMessaging.ts | sed -n '210,391p'
nl -ba AI/claude-code-analysis-main/src/bridge/replBridge.ts | sed -n '1190,1201p;1332,1341p'
nl -ba AI/claude-code-analysis-main/src/bridge/initReplBridge.ts | sed -n '397,451p'
nl -ba AI/claude-code-analysis-main/src/bridge/remoteBridgeCore.ts | sed -n '120,130p;422,447p'
nl -ba AI/claude-code-analysis-main/src/hooks/useReplBridge.tsx | sed -n '387,474p'
nl -ba AI/claude-code-analysis-main/src/bridge/replBridgeTransport.ts | sed -n '336,352p'
~~~

## 观察结果

- Bridge helper 把 server request 映射成带相同 `request_id` 与 session context 的 response；transport 不存在时没有响应可写。
- `initialize` 返回精简能力；模型、思考 token 和中断通过 callback 触发副作用；权限模式由调用方先做策略判断。
- `outboundOnly` 在 env-less 路径同时关闭 SSE 读取并拒绝可变控制请求，`initialize` 仍单独成功回应。
- callback 可选不代表每个分支都验证回调存在；成功响应不能单独证明本地状态已变更。

## 范围与限制

- 结论来自仓库当前 Claude Code 源码快照的静态阅读；没有连接 Remote Control/CCR 服务或验证服务端实际收到响应。
- 本课不逐项解释所有控制 schema，也不证明 callback 抛错、传输失败或服务端超时下的运行时恢复行为。
