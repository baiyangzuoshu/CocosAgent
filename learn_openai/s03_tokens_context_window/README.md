# 第 3 课：Token、上下文窗口与输入/输出长度

**目标：** 分清 Token、上下文窗口、输入长度和输出上限，并知道什么时候该估算、什么时候该精确计数。

## 本课问题

模型一次能处理多少内容？“几千字”为什么不能直接换算成“几千 Token”？

## 前置知识

- [第 2 课](../s02_text_generation_flow/README.md)：文本生成请求会把输入交给模型，再返回输出。

## 官方资料

- [Key concepts：Tokens](https://developers.openai.com/api/docs/concepts)：Token 的基本概念、英文文本的粗略估算方法和上下文长度入口。
- [OpenAI Tokenizer](https://platform.openai.com/tokenizer)：观察具体文本如何拆成 Token。
- [Conversation state：Managing the context window](https://developers.openai.com/api/docs/guides/conversation-state?api-mode=responses)：上下文窗口如何计算，以及输入、输出和推理 Token 的关系。
- [Counting tokens](https://developers.openai.com/api/docs/guides/token-counting)：精确统计 API 输入 Token 的方法和计数边界。

## 1. Token 不是“一个词”或“一个字”

Token 是模型处理文本时使用的片段，可能是常见字符组合、单词的一部分、标点或带空格的片段。例如，英文 `tokenization` 可以被拆成多个 Token，而常见的短词可能只占一个 Token。拆分取决于 Tokenizer，不是按空格切单词，也不是逐字符计数。[Key concepts](https://developers.openai.com/api/docs/concepts)

OpenAI 文档给英文文本一个粗略经验值：1 Token 大约相当于 4 个字符，或 0.75 个英文单词。这只是英文的粗略估计，不能直接拿来精确计算中文字符数。需要看具体文本时，可以把中英文短句都放进[官方 Tokenizer](https://platform.openai.com/tokenizer)观察切分结果。

## 2. 输入 Token 不只来自眼前那句话

一个请求的输入可能包含指令、当前问题、历史对话、工具定义，以及图片或文件等内容。角色和边界等请求结构也可能产生 Token。因此，屏幕上可见的文字长度不一定等于模型实际收到的输入 Token 数。[Counting tokens](https://developers.openai.com/api/docs/guides/token-counting)

多轮对话尤其容易累积：如果请求带上此前几轮内容，这些历史也要占用上下文空间。图像和文件的计数方式更不能按字符估算；准确输入计数需要使用与实际请求相同的模型和输入结构。

## 3. 上下文窗口是一次请求的总容量

上下文窗口（context window）是模型一次请求可使用的 Token 总量。可以先用下面的关系做心算：

```text
输入 Token + 模型生成的全部 Token（包括适用时的推理 Token）≤ 上下文窗口
```

推理模型产生的推理 Token 也会占上下文空间，即使这些 Token 不显示在最终文本里。每个模型的上下文窗口不同，具体数值应查当前[模型文档](https://developers.openai.com/api/docs/models)，不要把一个模型的上限套用到另一个模型。[Conversation state](https://developers.openai.com/api/docs/guides/conversation-state?api-mode=responses)

## 4. 上下文窗口与输出上限不是一回事

- **上下文窗口**限制一次请求的总容量，输入和模型生成的 Token 都要占空间；生成部分可能包含推理 Token。
- **输出上限**限制本次生成最多使用多少输出 Token。Responses API 可用 `max_output_tokens` 设置；它也会计算模型生成但不一定显示出来的 Token。

所以，即使某模型的上下文窗口还剩很多，输出上限也可能先到；反过来，输出上限设得很大，也不能让请求突破上下文窗口。需要一段特定长度的可见文本时应留余量，因为生成预算里可能有不显示在最终文本中的 Token。[Counting tokens](https://developers.openai.com/api/docs/guides/token-counting)

## 用 NPC 对话做一次容量估算

假设某个游戏模型的上下文窗口是 8,000 Token（**仅为教学假设，不代表某个实际模型**）：

| 请求部分 | 粗略 Token 数 |
| --- | ---: |
| NPC 角色指令 | 500 |
| 世界与任务状态 | 1,200 |
| 保留的历史对话 | 2,100 |
| 玩家最新问题 | 100 |
| 工具定义和请求结构等余量 | 300 |
| **输入合计估算** | **4,200** |

如果希望回答最多约 1,000 个生成 Token，粗略总量就是 4,200 输入 + 1,000 生成 = 5,200 Token，在这个假设窗口内留有余量。生成预算包括模型生成但不一定显示出来的 Token；它不是“保证 1,000 个可见 Token”。这个估算说明为什么对话历史、工具定义和输出长度要一起管理。真实项目应查具体模型限制，并用 Tokenizer 或输入 Token 计数接口核验；上表只是帮助建立容量概念。

## 观察练习

1. 打开[官方 Tokenizer](https://platform.openai.com/tokenizer)，比较 `The village is quiet tonight.` 和 `今夜村庄十分安静。` 的切分结果。
2. 思考一个 NPC 请求：如果玩家历史对话越来越长，哪一部分会挤占新问题和回答的空间？
3. Responses API 的输入 Token 计数接口可用与真实请求一致的 `model`、`input`、`instructions` 和 `tools` 统计输入；它统计的是输入，不会预先知道模型最终生成多少输出 Token。实际输出用量要在响应的 usage 中查看。[Counting tokens](https://developers.openai.com/api/docs/guides/token-counting)

## 本课检查

完成本课后，能解释：

- Token 是模型处理文本的片段，不等于词、字符或中文汉字。
- 上下文窗口管一次请求的总容量；输出上限管生成 Token 的最大额度。
- 输入计数可能包含历史、指令、工具结构和多模态内容，不只是用户最后输入的句子。
- 英文字符数经验值只能粗略估算；精确计数要看具体模型和完整请求。

## 简化与边界

- 公式是帮助理解的容量模型。具体字段限制、输出上限和模型行为以当前模型及 API 文档为准。
- 本课不背诵各模型的 Token 上限；这些值会变化，应在选模型时查官方模型页。
- Tokenizer 页面适合观察文本；完整 API 输入还可能有角色、格式、工具和多模态结构，必要时用输入 Token 计数接口核验。
- 本课不展开历史压缩、分块检索和长上下文设计，它们会在对话状态与 RAG 相关课程中继续学习。
