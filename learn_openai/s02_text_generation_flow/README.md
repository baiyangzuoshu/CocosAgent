# 第 2 课：生成式模型如何从输入生成输出

**目标：** 用一个简单、准确的心智模型说明文本请求如何产生输出，并理解输出不是固定模板。

## 本课问题

模型收到一句输入后，为什么会产生这段回答？同一句输入是否保证每次都得到完全相同的回答？

## 前置知识

- [第 1 课](../s01_system_model_api_sdk_app/README.md)：模型、API、SDK 和应用各自的职责。

## 官方资料

- [Text generation](https://developers.openai.com/api/docs/guides/text)：用 Responses API 将文本作为输入并生成文本输出；说明 `output` 和 `output_text`。
- [Key concepts](https://developers.openai.com/api/docs/concepts)：说明文本生成模型、Prompt 和 Token。
- [Create a model response](https://developers.openai.com/api/reference/resources/responses/methods/create)：说明 Response API 可接收文本等输入并生成响应。

## 先看 API 层发生什么

```text
input（提示/问题）
        ↓
所选模型处理输入
        ↓
API 返回 response
        ↓
应用读取并使用模型输出
```

OpenAI 的文本生成示例通过 Responses API 发送 `model` 和 `input`，再从返回对象读取文本。API 返回的 `output` 是项目数组；在简单的纯文本情形下，官方 SDK 可能提供 `output_text` 作为便捷汇总字段。更复杂的响应可以含有多个项目或工具调用，不能把它们都当作一段纯文本。[Text generation](https://developers.openai.com/api/docs/guides/text)

## 一个简化的生成模型

文本会被拆成模型处理的 Token。为了直观理解文本生成，可以把它想成一个逐步续写过程：

1. 模型读取输入和当前上下文。
2. 模型根据上下文生成一段后续内容。
3. 新生成的内容成为后续生成时的上下文之一。
4. 生成持续到模型结束本次响应或达到输出限制。

“逐步预测并续写 Token”是用于入门的简化心智模型，帮助理解为什么输入会影响后续输出；它不是 OpenAI 对所有模型内部实现的完整说明，也不是 API 保证的逐步推理过程。官方文档确认模型以 Token 处理文本，并将输出 Token 定义为模型根据提示生成的 Token；Token 的拆分方式留到第 3 课详细学习。[Key concepts](https://developers.openai.com/api/docs/concepts)、[Conversation state](https://developers.openai.com/api/docs/guides/conversation-state)

## 为什么同一输入不保证同一输出

文本生成具有非确定性：同一提示可能产生不同表达，也可能遗漏或误解细节。OpenAI 的文本生成文档明确提醒输出具有 non-deterministic 的特性。因此，重要结果需要在应用侧定义检查标准；单次回答看起来合理，不等于事实已验证。[Text generation](https://developers.openai.com/api/docs/guides/text)

## 用 NPC 台词观察输入与输出

```ts
const response = await client.responses.create({
  model: "当前要用的模型 ID",
  input: "为雪夜中的村庄 NPC 写一句欢迎旅人的台词。",
});

console.log(response.output_text);
```

这里的模型 ID 是占位说明。输入描述了任务和场景，模型据此生成台词；应用再读取响应并决定怎样呈现给玩家。无需 API Key 就能理解流程；实际 API 调用会在后续课程再练。

## 本课观察结果

看到一个生成请求时，能说清楚：

- `input` 是模型要处理的内容。
- `model` 选择由哪个模型处理。
- 模型根据输入生成响应；文本输出只是 Response 内容的一种形式。
- 生成结果可能变化，重要应用需要单独检查质量。

## 练习

同一个输入“为 NPC 写一句欢迎旅人的台词”，重复请求两次，输出是否必须逐字一样？为什么？请用“输入、上下文、生成、非确定性”几个词解释。

## 简化与边界

- 本课只讨论文本生成的概念流程，不展开 Token 计数、消息角色、上下文管理、采样参数或模型内部训练方法。
- “续写 Token”是教学用的简化解释；官方 API 文档描述可观察的输入、输出和 Token 概念，没有把它写成每个模型的完整内部执行规范。
- 本课的伪代码不作为可直接运行的脚本，示例中的模型 ID 不是实际模型名称。
