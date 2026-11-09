# 第 19 课：多轮对话如何保留或延续状态？

**目标：** 能比较应用自行提交消息历史与 Messages API 当前提供的 message threads（消息线程），并说明持久化、恢复和上下文窗口的边界。

## 本课问题

Claude API 如何在多个请求之间延续同一段对话？应用自行维护历史与服务器暂存消息线程各自做什么？使用线程后，应用是否可以丢掉自己的对话记录？

## 官方资料

- [Using the Messages API](https://platform.claude.com/docs/en/build-with-claude/working-with-messages)：无状态的基础多轮请求，以及当前的消息线程能力概览。
- [Message threads](https://platform.claude.com/docs/en/build-with-claude/message-threads)：创建和继续线程、线程恢复、线程生命周期与数据处理说明。
- [Context windows](https://platform.claude.com/docs/en/build-with-claude/context-windows)：哪些输入和输出会占用模型上下文窗口。

核对日期：2026-11-10。消息线程当前为 beta；平台、条款、可用性和数据处理说明可能更新，部署前应查看对应官方页面。

## 1. 基础方式：应用带上所需历史

基础 Messages API 调用是无状态的：每次请求都由应用提交 system 指令和需要的消息历史。要延续对话，应用在下一次请求中重复提供相关的 user 与 assistant 消息，并追加新一轮输入。

    {
      "model": "[当前可用模型 ID]",
      "max_tokens": 512,
      "system": "请用简洁中文回答。",
      "messages": [
        {"role": "user", "content": "什么是工作区？"},
        {"role": "assistant", "content": "工作区用于组织 API 使用。"},
        {"role": "user", "content": "它和组织有什么区别？"}
      ]
    }

示例表示第二轮请求中包含前一轮的对话和当前问题。需要哪些历史、保存多久、怎样删除或恢复，都由应用的数据层负责；先前的 assistant 消息也可以由应用按 API 格式构造，不一定非得来自前一次 Claude 响应。

| 做法 | 应用负责什么 | 适合的关注点 |
| --- | --- | --- |
| 每次提交对话历史 | 保存消息、选择需要的上下文、生成完整请求，并实现自己的恢复路径。 | 持久化和审计要求、精细的历史裁剪或应用端控制。 |
| 使用 API 消息线程 | 首次创建时提交完整对话；后续请求引用上次响应 ID 并只提交新增消息，同时仍保存应用自己的记录。 | 减少长对话每次上传和重新处理相同历史的开销。 |

## 2. 当前 API 能力：message threads

Anthropic 当前提供 beta 消息线程。创建线程时，像普通请求一样提交完整对话、system 和 tools，并增加 thread 创建参数。后续请求用上次响应的 id 继续，只发送新增消息；thread 会保留创建时的 system 和 tools，继续请求中不再重复提供。每次继续后，使用新响应的 id 作为下一次请求的引用。[Message threads](https://platform.claude.com/docs/en/build-with-claude/message-threads)

概念示意：

    第一次请求：
      system + tools + 完整消息历史 + thread: { type: "create" }
      响应：Message（其 id 用于下次继续）

    后续请求：
      新消息 + thread: { type: "continue", previous_message_id: "上次响应 id" }
      响应：新的 Message（更新下一次引用的 id）

代码结构需要按当前 SDK 或 API Reference 实现；这里仅展示创建与继续的关系，不是可直接运行的请求。线程保存在 API 一侧的短期状态中，底层仍会在调用模型前重建对话。线程主要减少应用重复发送整段历史的工作，并没有让 Claude 自动拥有对话之外的长期记忆。

## 3. API 线程不是应用的长期记录

官方文档把应用仍然定义为对话的事实来源。应用应保留完整消息历史，并从自己的副本构建重放路径。线程是 best-effort：它在最后一次请求后 5 分钟到期，且不迟于最后使用后 1 小时删除；若继续时线程已不可用，API 会返回 404，应用应以完整历史重新创建线程。官方 SDK 的 thread helper 可协助重放，但只把历史保存在 helper 对象的内存中；进程结束后仍需要应用自己的存储。

线程创建后会暂存对话内容、system、tools 和固定请求字段的指纹。当前文档说明，线程内容在由服务器管理密钥加密的内存中处理，不写入持久存储，但消息线程**不符合 Zero Data Retention（ZDR）或 HIPAA 资格**。若产品有相关数据处理要求，不能因为线程短暂或加密就忽略这项资格限制；应按官方数据处理说明和组织要求选择方案。[Message threads: Data retention](https://platform.claude.com/docs/en/build-with-claude/message-threads#data-retention) · [API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention)

## 4. 状态保留不等于上下文无限

线程会在调用模型前重建对话，所以完整对话仍会占用模型上下文窗口；system、messages、工具定义和生成结果都可能计入上下文。线程减少重复上传与处理历史的开销，但不等于压缩历史或扩大上下文容量。[Context windows](https://platform.claude.com/docs/en/build-with-claude/context-windows)

消息线程是追加式的，不能直接在原线程中用摘要替换早期消息。若长对话需要压缩，官方说明的路径是从摘要创建一个新线程。摘要应由应用按任务需求构造，并保留后续仍然需要的关键事实；线程本身不替应用决定什么历史可丢弃。[Message threads: Compact a conversation](https://platform.claude.com/docs/en/build-with-claude/message-threads#compact-a-conversation)

## 5. 如何选择

选择方式时先看应用对记录与恢复的要求：

1. 需要长期保存、跨进程恢复或自行定义删除期限时，应用必须维护自己的对话副本和恢复流程。
2. 需要减少长对话中每轮重复传输整段历史的工作，且当前 API、平台和数据处理条件适合时，可以评估 beta message threads。
3. 无论选择哪种方式，都要为上下文长度增长设计消息裁剪或摘要方案，并在异常情况下能从应用侧状态重建请求。

消息线程不是永久数据库，也不是跨会话记忆产品；它是一种短期服务端延续机制。若所用平台不支持线程、线程已到期或数据处理资格不适用，回退到应用自行提交完整消息历史的模式。

## 练习：选择状态来源

一个客服机器人要支持用户隔周回来继续对话，保存经用户同意的订单进度，并且在服务中断后恢复。工程团队还希望减少长会话每轮重复上传历史的开销。请说明应用自己的记录和消息线程各承担什么职责，并指出需要评估的限制。

**参考答案：** 应用数据库保存经同意的订单进度和可恢复的对话记录，应用是长期事实来源；若 API 和平台支持且数据资格满足，可使用消息线程降低短时间连续对话的重复上传成本。线程短期过期，不能支撑隔周恢复；继续失败时应从应用历史重放并创建新线程。还应核对线程不具备 ZDR/HIPAA 资格，并为上下文窗口增长准备摘要或裁剪方案。

## 本课结论

多轮对话的基本机制仍是应用向每次 Messages 请求提供所需历史。当前 beta message threads 可暂存短期对话，让后续请求引用前一响应并只提交新增消息；它不替代应用保存长期记录、恢复对话或满足数据处理要求。线程也不会让模型上下文无限增长，因此应用需要管理历史和恢复路径。

## 范围与时效

- 官方文档核对日期：2026-11-10。
- 消息线程状态、生命周期、平台支持和数据处理资格以当前官方文档为准。
- 本课讨论 Messages API 的多轮状态延续，不展开服务端 Agent/Sessions 产品；上下文窗口和 compaction 细节以对应专题文档为准。
