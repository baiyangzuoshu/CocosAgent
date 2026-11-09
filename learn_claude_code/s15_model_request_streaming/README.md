# 第 15 课：模型请求与流式 API

**目标：** 沿生产依赖 `queryModelWithStreaming` 追踪 Query 输入如何变成 API 请求，以及原始流事件如何转成 Query 可消费的输出。本课聚焦请求边界和 API 流，不展开 UI 更新、重试策略或工具执行闭环。

## 本课要回答的问题

1. `queryLoop()` 传给模型依赖哪些数据和控制项？
2. `claude.ts` 如何把消息、提示词、工具和模型选项组成请求参数？
3. 请求如何启动流式响应，原始事件如何变成内部消息？

## 调用链：Query 交出输入，API 模块取得流

`QueryDeps.callModel` 的生产实现是 `queryModelWithStreaming`。`queryLoop()` 把当前消息、完整系统提示、thinking 配置、工具、取消信号和一组请求选项传进去。API 模块再负责消息归一化、工具 Schema 生成、系统提示块构造、请求参数生成和客户端选择。

~~~mermaid
flowchart LR
  A[queryLoop] -->|messages / prompt / tools / options / signal| B[QueryDeps.callModel]
  B --> C[queryModelWithStreaming]
  C --> D[queryModel 准备请求]
  D --> E[normalize messages / tools / system]
  E --> F[paramsFromContext]
  F --> G[getAnthropicClient]
  G --> H[beta.messages.create stream=true]
  H --> I[原始流事件]
  I --> J[AssistantMessage / API error / StreamEvent]
  J --> A
~~~

## Query 传入的请求边界

| 输入 | `queryLoop()` 传入的值 | API 层的用途 |
| --- | --- | --- |
| 对话与用户上下文 | `prependUserContext(messagesForQuery, userContext)` | 进入 API 消息归一化和请求历史 |
| 系统提示 | `fullSystemPrompt` | 追加归属与 CLI 前缀等内容，再组装为 API system blocks |
| 工具与 thinking | `toolUseContext.options.tools`、`thinkingConfig` | 过滤工具、生成 API tool schemas，按模型能力生成 thinking 参数 |
| 取消控制 | `abortController.signal` | 传给 SDK 请求，使流请求可响应取消 |
| 请求选项 | 当前 `model`、`querySource`、`fallbackModel`、输出上限、task budget、权限上下文、MCP/Agent 信息等 | 影响模型路由、工具 Schema、请求正文和观测元数据 |

`QueryDeps` 是调用边界：生产实现连接 `queryModelWithStreaming`，但本课看到的具体 API 组装都发生在 `src/services/api/claude.ts`。其中 `fetchOverride`、权限上下文回调和 `onStreamingFallback` 也随选项传入；回退与重试的控制关系留到后续课程。

## 从对话对象到 API 请求正文

进入 `queryModel()` 后，消息不会原样直传。源码先按当前工具集合执行 `normalizeMessagesForAPI()`，再修复 `tool_use` / `tool_result` 配对，按模型能力移除不支持的 tool search 或 advisor 字段，并限制单次请求中的媒体条目数。工具集合也可能按 deferred tool search 规则过滤，再由 `toolToAPISchema()` 转成 API Schema。

系统提示会加入归属标记、CLI 前缀，以及满足条件时的 advisor 或 Chrome tool-search 指令；之后 `buildSystemPromptBlocks()` 生成 API 所需的 system 参数。缓存标记、beta headers 和 provider 附加参数也是请求组装的一部分。

`paramsFromContext()` 根据当前请求上下文生成请求参数；例如输出 token 上限会优先采用 retry context 的覆盖值。主要字段可以这样读：

| 请求字段 | 来源或作用 |
| --- | --- |
| `model` | 规范化后的模型名 |
| `messages`、`system`、`tools` | 归一化后的对话、system blocks 和 API 工具 Schema |
| `tool_choice` | 当前 Query 选项；`queryLoop()` 此处传 `undefined` |
| `max_tokens` | retry context 覆盖值、Query 输出覆盖值或模型默认上限，依次选择 |
| `thinking`、`temperature` | 按 thinking 配置和模型能力构造；thinking 启用时不发送 temperature |
| `betas`、`metadata`、`context_management` | 由 provider、功能和当前请求上下文决定 |
| `output_config`、`speed`、额外参数 | 合并 effort、task budget、结构化输出等受支持选项 |

随后 `getAnthropicClient()` 根据当前 provider 建立对应 SDK 客户端，并应用认证、请求头、代理、超时或传入的 fetch 覆盖。`queryModel()` 调用 `anthropic.beta.messages.create({ ...params, stream: true }, { signal, headers })`，再通过 `.withResponse()` 取得流数据、request ID 和 Response。这里使用 raw stream，以便自行累积工具输入 JSON，不依赖 SDK 的逐片 JSON 解析。

## 原始流怎样变成内部输出

`queryModelWithStreaming()` 通过 `withStreamingVCR()` 委托给 `queryModel()`。VCR 关闭时直接转发生成器；启用时由 VCR 记录或读取消息序列。正常 API 路径中，`queryModel()` 逐个消费原始流事件：

| API 事件 | `claude.ts` 中的处理 |
| --- | --- |
| `message_start` | 保存部分消息并初始化累计 usage |
| `content_block_start` | 按索引初始化 text、thinking、tool_use 等内容块 |
| `content_block_delta` | 累加文本、thinking 或工具输入的 JSON 片段 |
| `content_block_stop` | 归一化已完成内容块，构造并 yield `AssistantMessage` |
| `message_delta` | 更新最终 usage 和 stop reason；输出到达上限时 yield API 错误消息 |

在事件处理分支之外，每个原始事件还会被包装为 `StreamEvent` 再 yield。因此生成器输出可能交错包含已归一化的 assistant 消息、API 错误消息和原始流事件。Query 消费这些输出并据此决定后续工作；终端组件如何展示留到第 16 课。

`content_block_stop` 可以先 yield assistant 消息；稍后到来的 `message_delta` 再把最终 usage 和 stop reason 写回最后一个已 yield 消息。源码选择直接修改对象，是为了让异步 transcript 写队列保留的引用也能读到最终值。

流以 `finally` 释放：取消底层 stream，并清理 Response body，避免生成器正常结束、异常或提前关闭时留下网络资源。

## 静态观察

在仓库根目录执行以下命令，只读取源码：

~~~sh
nl -ba engine/claude-code-analysis-main/src/query/deps.ts | sed -n '1,42p'
nl -ba engine/claude-code-analysis-main/src/query.ts | sed -n '652,708p'
nl -ba engine/claude-code-analysis-main/src/services/api/claude.ts | sed -n '676,780p;1017,1072p'
nl -ba engine/claude-code-analysis-main/src/services/api/claude.ts | sed -n '1231,1380p;1538,1595p;1691,1728p'
nl -ba engine/claude-code-analysis-main/src/services/api/claude.ts | sed -n '1776,1858p;1979,2053p;2171,2212p;2213,2304p;2808,2816p'
nl -ba engine/claude-code-analysis-main/src/services/api/client.ts | sed -n '88,152p;153,220p;221,316p'
nl -ba engine/claude-code-analysis-main/src/services/vcr.ts | sed -n '349,380p'
~~~

## 观察结果

Query 负责提供本轮对话、上下文和控制选项；`claude.ts` 将其转换为经归一化的消息、system blocks、工具 Schema 和 Beta API 参数，再由 provider 对应的客户端发起流式请求。响应不是一次性组装后返回：内容块完成时形成内部 assistant 消息，原始 API 事件也作为 `StreamEvent` 继续向 Query 流出。

## 简化与限制

- 本课只整理请求输入、参数构造和原始流的第一层转换，不详解缓存策略、Beta 能力矩阵、Provider 认证，也不替代第 16 课的 UI 事件路径。
- 流创建后的超时、重试、模型回退和中断策略较多，留到第 18 课；本课只标出相关边界。
- 当前源码目录没有构建清单；结论来自静态源码阅读，没有运行 API 请求、模型流或测试。
