# 第 19 课：LLM 服务与 Provider

**目标：** 观察统一 LLM 服务怎样按 provider 路由选择适配器，并让同一消费方切换底层 Provider。

## 本课问题

AgentLoop 或其他消费者如何不依赖具体模型厂商？Adapter 怎样把统一请求转换成 Provider 调用，同时把流式输出转换回共同的 chunk 协议？

## 本课增量

本课加入 `LlmRuntime` 路由注册表、`LlmAdapter` 合同和两个确定性的 Fake Adapter。消费方始终调用同一个 `ChatClient.ask()` 与 `llm.stream()`；请求中的 provider 路由选择具体 Adapter。适配器把答案作为通用的 block/text/usage/finish chunk 流交回服务。

```text
ChatClient ── GenerateOptions(provider, model, messages) ──> LlmRuntime
                                                              │ provider route
                                             ┌────────────────┴──────────────┐
                                         Fake Alpha                      Fake Beta
                                             └── block/text/usage/finish ───┘
```

运行时先注册 `fake-alpha` 与 `fake-beta` 两个路由，再用完全相同的 prompt 分别请求。只有 provider 字段变化，输出前缀则由适配器决定。

## 源码对照

- [`packages/llm/llm/README.zh.md`](../../../deepseek-harness/packages/llm/llm/README.zh.md)：统一服务、适配器注册和 `ctx.llm.stream()` 的消费者视角。
- [`packages/llm/llm/src/index.ts`](../../../deepseek-harness/packages/llm/llm/src/index.ts)：`LlmAdapter`、`registerAdapter()`、provider 路由和 `LlmRuntime.stream()`。
- [`packages/llm/llm/src/types.ts`](../../../deepseek-harness/packages/llm/llm/src/types.ts)：`GenerateOptions` 与通用 `StreamChunk` 协议。
- [`packages/core/agent-loop/src/agent.ts`](../../../deepseek-harness/packages/core/agent-loop/src/agent.ts)：AgentLoop 通过统一 LLM 接口发起请求，不直接选择 Provider 实现类。
- [`docs/subsystems/llm-streaming.md`](../../../deepseek-harness/docs/subsystems/llm-streaming.md)：Adapter 的分片合同和 `ctx.llm` 服务入口。

## 代码结构

```text
s19_llm_service_provider/
├── README.md
├── deno.json
└── src/
    ├── chat-client.ts
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

预期结果：两个 Fake Adapter 都从同一 `ChatClient.ask()` 入口收到一条 user 消息，并分别返回 Alpha、Beta 前缀；消费者按 text-delta 收集相同的标准输出流。释放注册句柄后 provider 列表为空。

## 观察结果

- `GenerateOptions.provider` 是路由键；`LlmRuntime` 查表后选择已注册 Adapter。消费者只依赖 `LlmRuntime.stream()`，不需导入 `FakeAdapter` 或实际 Provider 类。
- 一个 Adapter 可以注册一个或多个 provider 路由。注册会整体校验路由，重复路由不能覆盖已运行的 Adapter；返回 disposer 释放该注册拥有的路由。
- Adapter 只需要实现统一请求到流的边界。Provider wire 格式、认证、HTTP、模型能力解析由具体适配器拥有；本例 Fake 适配器不做网络 I/O。
- Adapter 输出 `block-start → text-delta → block-end → usage → finish`，消费者通过公共 chunk 类型读取结果。不同 Provider 可以有不同传输实现，但共享同一条内部协议。
- AgentLoop 和会话标题、压缩摘要等辅助消费者都通过 `ctx.llm` 发起模型请求；服务本身不带某一家协议实现。
- 配置目录与实际 adapter 路由是不同概念：一个 Provider 可以先被声明为可配置但尚未注册。本例省略 dormant provider 配置目录。

## 简化与边界

- 示例没有启动 Cordis；`LlmRuntime` 只实现 provider 注册、查找、流转发和 disposer，不包含配置目录、模型目录、HMR 替换、作用域卸载和 `prepareCall()`。
- 请求只含 provider、model 与文本消息；省略 model capability 校验、默认调用参数、system prompt/工具/image/file 投影、replay state 和冻结检查。
- Fake Adapter 生成固定文本，并按完整协议块发出增量。没有 Provider wire、凭据、网络超时、重试策略、真实 usage、错误恢复或取消竞态；第 20 课继续处理流、取消与失败结算。
- 示例中的 failure chunk 只保留 `NO_ADAPTER`/`UNKNOWN` 两个通用分支，不复刻 Harness 完整的 `LlmFailure` 分类。

---

下一课预告：第 20 课「流、取消与失败结算」会观察分片流怎样在成功、取消或失败时结束。
