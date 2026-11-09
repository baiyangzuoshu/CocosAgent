# 第 20 课：流、取消与失败结算

**目标：** 跟踪一个模型流从实时分片到持久 Session 结果的过程，比较正常完成、用户取消和 Provider 失败的结算方式。

## 本课问题

流中的 token 什么时候成为正式对话消息？取消时已经显示的前缀怎样保存？Provider 抛错时，为什么要记录一次失败尝试，却不能把半截文本当作完整回答？

## 本课增量

本课在第 19 课的统一 Provider 路由之后加入三层行为：`LlmRuntime` 把 Adapter 抛出的错误转换为终止 `finish` chunk；`AssistantStreamAttempt` 同时收集实时 chunk 并在结算后发出结束帧；Turn 消费者根据完成、取消或失败写入不同的 Session 事件。

```text
Fake Adapter ── chunks / throw ──> LlmRuntime
                                      │ error/aborted → finish chunk
                                      ▼
                             AssistantStreamAttempt
                           start → chunk* → end
                                      │ commit
             ┌────────────────────────┼────────────────────────┐
       assistant/message      assistant/message       assistant/attempt
       turn completed         interrupted prefix      turn error
                              turn aborted
```

示例运行三个确定性 Provider：成功流提交完整 `assistant/message`；中途抛错的流以 `finish:error` 结束，记录 `assistant/attempt`；用户取消时保留已收到的可见前缀，写入带 `interrupted: true` 的消息，再以 `turn/end: aborted` 结束。

## 源码对照

- [`packages/llm/llm/src/index.ts`](../../../deepseek-harness/packages/llm/llm/src/index.ts)：Adapter 创建或迭代失败时规范化为 `finish:error` 或 `finish:aborted`；把消费者异常留作异常传播。
- [`packages/llm/llm/src/assembler.ts`](../../../deepseek-harness/packages/llm/llm/src/assembler.ts)：从 block 和 delta chunk 组装内容，也提供中断时的安全前缀。
- [`packages/core/agent-loop/src/assistant-stream.ts`](../../../deepseek-harness/packages/core/agent-loop/src/assistant-stream.ts)：发布实时 `start/chunk/end` 帧；只有持久事件提交后，才发送已提交的结束帧。
- [`packages/core/agent-loop/src/agent.ts`](../../../deepseek-harness/packages/core/agent-loop/src/agent.ts)：消费 LLM 流，区分失败尝试、取消时的部分消息和正常消息，然后关闭 step 与 turn。
- [`packages/core/session/src/types.ts`](../../../deepseek-harness/packages/core/session/src/types.ts)：定义 `assistant/message`、`assistant/attempt` 与 `turn/end` 的持久事件结构。
- [`docs/subsystems/llm-streaming.md`](../../../deepseek-harness/docs/subsystems/llm-streaming.md)：说明 Adapter 失败如何进入公共 chunk 协议，以及 Assistant stream 的持久结算。

## 代码结构

```text
s20_llm_stream_cancel_settlement/
├── README.md
├── deno.json
└── src/
    ├── assistant-attempt.ts
    ├── fake-adapter.ts
    ├── llm-runtime.ts
    ├── main.ts
    └── types.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

预期结果：成功场景先出现 `assistant/message`，再以 `completed` 结束；取消场景的消息包含已见前缀和 `interrupted: true`，随后以 `aborted` 结束；失败场景写入带原始 stream 的 `assistant/attempt`，随后以结构化 `error` 结束。实时帧的 `end` 帧引用已经提交的 Session 事件序号。

## 观察结果

- Adapter 的异常由 LLM 服务翻译成终止 chunk；`AgentLoop` 消费者看到的是统一的流协议，不需要分辨 HTTP 客户端抛出的异常类型。
- `finish:error` 不会生成一条完整的助手消息。它落入 `assistant/attempt`，所以失败分片可审计，但不会伪装成模型已完成的回答。
- 取消发生在收到可见 token 之后时，Loop 保存中断前缀为 `assistant/message` 并标记 `interrupted: true`。如果一个可见 token 都没有，Harness 记录 `assistant/attempt`，而不是空消息。
- `turn/end` 说明回合最终结果；`assistant/message` 或 `assistant/attempt` 说明单次模型请求的产物。二者位于不同层级，不能互相替代。
- `agent/assistant-stream` 的结束帧在对应持久事件提交后发布，因而实时 UI 可以把流结束和持久化完成对齐。
- Adapter 中止时需要及时响应 `AbortSignal` 并关闭底层迭代器；仅设置 signal 不会自动停止一个忽略取消信号的 Provider。

## 简化与边界

- 本课以小型 `SessionLog` 模拟持久事件追加，未启动 Cordis、真实 `Session`、`BlockAssembler`、消息校验或 checkpoint 策略。
- 协议仅保留文本 block 和 finish；没有 reasoning、工具调用、usage、replay、时间戳压缩和完整错误分类。
- Fake Adapter 通过延迟后检查 signal 模拟取消响应，不代表真实网络传输的中断时序、资源回收或超时策略。
- 示例把取消原因固定为 `user`，省略 Harness 支持的父级、hook、dispose 等来源和 Inbox 的取消行为。
- Provider 失败例子由 Adapter 抛错触发 LLM 服务生成 `finish:error`；真实 Provider 适配器可能先解析 HTTP/SSE 错误，再提供结构化 `LlmFailure`。

---

下一课：[第 21 课「Tool Schema 与注册」](../s21_tool_schema_registration/README.md) 将展示工具定义如何变成模型请求中的参数 schema。
