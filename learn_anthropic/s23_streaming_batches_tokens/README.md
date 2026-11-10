# 第 23 课：Streaming、批处理和 Token 计数分别解决什么问题？

**目标：** 能根据交互时延、请求规模和输入预算选择 Streaming、Message Batches 或 Token Counting，并说明三者不能互相替代的边界。

## 本课问题

如果用户要边等边看回答、应用需要处理大量离线请求，或开发者要估算输入会占多少上下文，分别应该用什么功能？这些方式会不会改变请求本身的作用？

## 官方资料

- [Streaming Messages](https://platform.claude.com/docs/en/build-with-claude/streaming)：增量事件、SDK 读取方式和流结束标志。
- [Batch processing](https://platform.claude.com/docs/en/build-with-claude/batch-processing)：异步处理多条 Messages 请求、状态轮询、批量结果与限制。
- [Token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting)：发送前估算输入 token、可计数输入和计数限制。
- [Count tokens in a Message API Reference](https://platform.claude.com/docs/en/api/messages/count_tokens)：计数端点的请求与 input_tokens 响应字段。

核对日期：2026-11-10。批处理折扣、完成时间、请求上限、Token 使用量和平台兼容性可能调整；实际使用前应查看当前官方页面。

## 1. 先看它们解决的不是同一个问题

| 能力 | 主要目的 | 等待方式 | 典型场景 |
| --- | --- | --- | --- |
| Streaming | 让应用逐段接收一次 Messages 响应。 | 保持连接，按事件增量读取；完整结束前可展示已到达的内容。 | 面向用户的实时对话、长回答进度展示。 |
| Message Batches | 把多条相互独立的 Messages 请求交给 API 异步处理。 | 提交后查询处理状态，再集中读取结果。 | 离线评估、批量分类、摘要或内容检查。 |
| Token Counting | 在正式生成前估算一次请求的输入 token。 | 单独发出计数请求，返回 input_tokens。 | 控制上下文预算、模型路由和输入成本估算。 |

Streaming 改变的是响应如何到达客户端；Batches 改变的是多条请求如何异步排队和取回；Token Counting 是生成前的输入预算工具。它们可组合使用，但不能把一次批量处理当作流式对话，也不能把 token 预估当成模型回答。

## 2. Streaming：尽早展示逐步到达的内容

Messages 请求可设置 stream 为 true，以 Server-Sent Events（SSE）接收响应；Anthropic SDK 也提供 messages.stream() 一类 helper。应用可在文本片段到达时逐步展示，或等流结束后读取完整 Message 对象。

原始 SSE 一般会出现 message_start、content_block_start、content_block_delta、content_block_stop、message_delta 和 message_stop 等事件，也可能出现 ping 或后续新增的事件类型。content_block_delta 携带文本或工具输入等增量；message_delta 包含停止原因等最终变更，message_stop 表示这条流结束。直接处理 SSE 时，应允许未知事件类型并按索引累积内容块；使用 SDK 可以少写事件组装代码。[Streaming Messages](https://platform.claude.com/docs/en/build-with-claude/streaming)

Streaming 适合降低用户感受到的等待时间：用户可以先看到开头内容。但它不把请求变成批处理，也不代表模型已经完成整个回答。应用要区分“当前收到的部分输出”和“流已完成的完整消息”，并在结束时处理 stop_reason 和错误事件。

## 3. Message Batches：异步处理大量独立请求

Message Batches API 一次提交多条 Messages 请求，每条请求独立运行；应用查询批次状态，结束后读取结果。每个请求应设置唯一 custom_id，取回结果时按 custom_id 关联业务记录，不要依赖结果行顺序与提交顺序一致。[Batch processing](https://platform.claude.com/docs/en/build-with-claude/batch-processing)

当前官方指南描述其适合不要求立即返回的大规模工作：通常多数批次在一小时内完成，标准 API 价格基础上可节省 50%。批次仍是异步任务，不适合作为交互式对话的同步响应机制；stream 为 true 的请求也不能放入批次。

截至本课核对时，单个批次上限为 100,000 条 Messages 请求或 256 MB（以先到者为准）；批次如未在 24 小时内完成会过期，结果在创建后 29 天内可下载。批处理的可用平台、限流和数据处理资格也需要核对；当前官方页面将 Batch Processing 标为不具备 ZDR 或 HIPAA 资格。以上数值和条件随官方页面更新。[Batch processing](https://platform.claude.com/docs/en/build-with-claude/batch-processing)

## 4. Token Counting：发送前估算输入预算

Token Counting 使用 POST /v1/messages/count_tokens 或 SDK 对应方法，传入准备发送的 model、system、messages 和工具定义等输入，响应提供 input_tokens。它用于估算本次请求输入占用，不会生成 Claude 回答，也不计算未来输出会使用多少 token。正式请求返回的 usage 才记录实际请求用量；预估与实际值可能略有差异。[Token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting)

计数端点支持 system、消息、工具定义以及 base64 图像和 PDF 等输入。但对若干 Messages API 能接受的输入，Token Counting 端点当前会返回错误，包括大多数服务端工具、MCP Connector，以及 image/document 内容块中的 URL 或 file 来源；为预估这类正式请求的 token，用实际 Messages 响应中的 usage 观察结果。计数按请求中的模型进行，迁移模型或变更输入后应重新计数。

官方当前说明 Token Counting 不收费，但受请求速率限制；它并不执行 prompt caching 逻辑。因此，不能把计数结果直接当成缓存后费用，也不能把 input_tokens 当作包含 max_tokens 的总预算。规划上下文时还要为预期输出和工具循环留空间。[Token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting)

## 5. 把三种方式放进一个流程

一个在线客服页面可使用 Streaming 及时显示单次答案；若产品每天要离线分析数万条历史工单，可把独立请求放入 Message Batches；在正式发送长上下文前，可先用 Token Counting 检查输入预算，并在模型或提示变化后重新估算。异步任务结果可以进入应用数据库，和实时聊天的消息状态分别管理。

选择前依次问：

1. 是否需要用户在生成完成前看到内容？需要则评估 Streaming。
2. 这批请求能否异步处理，且能等待批次结果？能且规模足够时评估 Batches。
3. 输入是否接近模型上下文、速率或成本预算？先 count_tokens，生成后再核对 usage。
4. 是否在依赖当前折扣、速率限制、批次上限或平台支持？从当前文档复核这些易变条件。

## 练习：给三项工作选方案

团队有三个需求：A. 用户正在对话，需要看到 Claude 逐步输出；B. 每晚分析 30,000 条产品反馈，第二天早晨再读取分类结果；C. 提示词加入长篇 PDF 后，想确认输入是否接近模型上下文窗口。分别选择合适的能力，并指出一项需要保留或核对的信息。

**参考答案：** A 使用 Streaming，处理分段事件并等 message_stop 才把响应视为完整；B 使用 Message Batches，为每条请求设置唯一 custom_id，异步轮询状态并检查批次过期、折扣、数据处理资格与结果保留期限；C 使用 Token Counting 对目标模型和请求内容计数，但 PDF 若使用 URL/file_id 来源可能不能通过此端点计数，可改用支持的 base64 输入或以正式 Messages 响应的 usage 观察实际用量。计数只估算输入，输出也要留预算。

## 本课结论

Streaming 解决一次响应的渐进交付；Message Batches 解决可等待的大规模异步处理；Token Counting 解决生成前的输入预算估算。选型时从用户是否需即时反馈、请求数量与吞吐、输入上下文预算三方面判断，并在运行后查看 stop_reason、批次结果和实际 usage。

## 范围与时效

- 官方文档核对日期：2026-11-10。
- 本课列出的批次优惠、规模、完成时限和结果保留时间为核对日页面信息；部署时应复查当前指南。
- 多模态输入见第22课；API 错误、重试和速率限制见第24课；质量评估见第26课。
