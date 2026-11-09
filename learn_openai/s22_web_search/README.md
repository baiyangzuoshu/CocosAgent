# 第 22 课：Web Search 怎样补充实时网页信息？

**目标：** 能在 Responses API 中配置 Web Search；能区分默认的可选搜索与必须搜索；能在响应里识别 `web_search_call`、回答文本和 URL 引用，并按需要取得完整来源列表。

## 本课问题

模型训练时不知道的新信息，怎样通过 Web Search 补充？搜索结果和最终引用分别在哪里？

## 前置知识

- [第 8 课](../s08_responses_request_response/README.md)：读取 Responses 输出项目。
- [第 18 课](../s18_file_search_vector_stores_rag/README.md)：区分公开网页搜索与自有文件检索。
- [第 21 课](../s21_builtin_tools_vs_functions/README.md)：理解 OpenAI 内置工具与自定义函数的执行边界。

## 官方资料

- [Web search](https://developers.openai.com/api/docs/guides/tools-web-search)：查看 Responses API 的 Web Search 配置、引用、域名过滤和结果来源。
- [Using tools](https://developers.openai.com/api/docs/guides/tools)：查看模型如何选择已配置的工具。
- [Create a model response](https://developers.openai.com/api/reference/resources/responses/methods/create)：核对 `tools`、`tool_choice` 和 `include` 请求字段。
- [Responses API Reference](https://developers.openai.com/api/reference/resources/responses)：查找 `web_search_call`、`message` 和引用注释结构。

## 1. Web Search 是 Responses API 的内置工具

新建 Responses API 集成时，使用 `web_search` 工具。模型可以根据问题决定是否搜索网页，再把搜索结果作为上下文生成回答。默认 `tool_choice: "auto"` 时，搜索是可选的；如果任务规定必须查询网页，可使用 `tool_choice: "required"`。只配置 Web Search 一个工具时，`required` 会要求模型调用可用工具之一。[Web search](https://developers.openai.com/api/docs/guides/tools-web-search)

这几种数据不要混淆：

| 目标 | 使用方式 | 数据在哪里 |
| --- | --- | --- |
| 查询互联网上的公开信息 | Responses API + `web_search` | `web_search_call` 和模型回答 |
| 查询已上传至 Vector Store 的资料 | Responses API + `file_search` | `file_search_call` 与文件引用，见第 18 课 |
| 访问应用自己的订单、库存或专用服务 | Function Calling 或合适的外部工具连接 | 应用执行的函数结果，见第 20、21 课 |

旧版 `web_search_preview` 仍供既有集成使用，但新集成应使用 `web_search`；Preview 不支持部分较新的搜索控制。[Web search：Migrating from legacy web search](https://developers.openai.com/api/docs/guides/tools-web-search)

## 2. 发出带域名范围的搜索请求

下面的例子要求搜索 OpenAI 开发者文档里的 Responses API 资料，并请求完整的工具来源列表。域名过滤支持域名字符串，不要写 `https://` 前缀；它缩小搜索范围，但不代表对该域名内所有相关页面做了穷尽检查。[Web search：Domain filtering and sources](https://developers.openai.com/api/docs/guides/tools-web-search)

```ts
import OpenAI from "openai";

const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-6-astra",
  input: "查找 OpenAI Responses API 的 Web Search 工具怎样配置，并总结调用后返回什么。",
  tools: [
    {
      type: "web_search",
      search_context_size: "medium",
      filters: {
        allowed_domains: ["developers.openai.com"],
      },
    },
  ],
  tool_choice: "required",
  include: ["web_search_call.action.sources"],
});

console.log(response.output_text);
console.dir(response.output, { depth: null });
```

`search_context_size` 控制提供给模型的搜索上下文规模，不能理解成固定的搜索条数、引用数或 Token 数。`include: ["web_search_call.action.sources"]` 请求完整来源列表；若只要回答实际引用了什么来源，应读取 `message` 内容上的 `url_citation` annotations。[Web search](https://developers.openai.com/api/docs/guides/tools-web-search)

## 3. 从响应里读搜索过程和引用

使用 Web Search 的响应通常在 `output` 中包含不同用途的项目：

```json
[
  {
    "type": "web_search_call",
    "status": "completed",
    "action": {
      "type": "search",
      "query": "Responses API Web Search tool configuration"
    }
  },
  {
    "type": "message",
    "role": "assistant",
    "content": [
      {
        "type": "output_text",
        "text": "网页搜索可以通过 Responses API 的 web_search 工具启用……",
        "annotations": [
          {
            "type": "url_citation",
            "start_index": 18,
            "end_index": 42,
            "url": "https://developers.openai.com/api/docs/guides/tools-web-search",
            "title": "Web search"
          }
        ]
      }
    ]
  }
]
```

`web_search_call` 记录发生了什么搜索动作；`message` 保存模型给用户的回答；`url_citation` annotation 将回答中的一段文字与来源 URL 和标题关联起来。实际响应可能包含多个搜索动作或输出项目，不要假设固定只有两项。[Web search：Output and citations](https://developers.openai.com/api/docs/guides/tools-web-search)

如果产品界面要显示可点击的来源，读取 annotation 的 URL、标题和文本位置，并把引用呈现为明显的链接。不要把 `response.output_text` 当作完整的引用结构；要检查相应的 `message.content[].annotations`。[Web search](https://developers.openai.com/api/docs/guides/tools-web-search)

完整来源列表与文本中的引用不是一回事：`web_search_call.action.sources` 会给出模型搜索过程中取得的来源；消息中的 `url_citation` 是回答实际附带的引用。来源列表可能比回答中引用的来源更多。[Web search：Sources](https://developers.openai.com/api/docs/guides/tools-web-search)

## 4. 控制搜索条件

| 配置 | 用途 | 注意事项 |
| --- | --- | --- |
| `tool_choice: "auto"` | 默认行为；模型可自行决定是否搜索 | 问题不需要外部资料时，它可能不搜索 |
| `tool_choice: "required"` | 要求模型调用至少一个可用工具 | 只有 Web Search 可用时，会要求进行搜索；有多个工具时，不等于强制选 Web Search |
| `filters.allowed_domains` / `blocked_domains` | 限定允许或排除的来源域名 | 域名过滤不能保证页面内容正确或搜索完整 |
| `search_context_size` | 控制提供给模型的搜索上下文规模 | 不承诺固定查询条数、来源数量或回答质量 |
| `include: ["web_search_call.action.sources"]` | 返回完整搜索来源列表，便于检查或记录 | 来源列表可大于答案引用列表 |

想限定来源时，可以优先指定可信的官方域名；回答后仍需打开原始页面核对发布时间、页面内容和引用是否支撑结论。Web Search 会帮助找资料，不会自动证明搜索结果是最新、完整或正确的。[Web search](https://developers.openai.com/api/docs/guides/tools-web-search)

## 5. 观察练习

判断是否需要 Web Search；如果需要，说明如何控制工具选择以及在响应里核对什么：

| 问题 | 你的选择 |
| --- | --- |
| OpenAI API 今天是否发布新版本？需要官方来源 | 待填写 |
| Vector Store 是什么？只需解释已学过的稳定概念 | 待填写 |
| 查询公司刚上传到 Vector Store 的差旅制度 | 待填写 |
| 读取用户自己的订单状态 | 待填写 |

再回答：`web_search_call.action.sources` 和 `message.content[].annotations` 各代表什么？如果产品必须执行搜索，`tool_choice: "auto"` 是否足够？

## 本课检查

完成本课后，能解释：

- Responses API 新集成通过 `{ type: "web_search" }` 开启 Web Search；默认 `auto` 时模型可以自行决定是否搜索。
- `required` 可要求模型调用工具，但当请求有多个工具时，不会单独指定 Web Search。
- `web_search_call` 表示搜索动作；回答位于 `message`；`url_citation` annotation 带有来源 URL、标题和回答中的位置。
- `web_search_call.action.sources` 提供搜索过程取得的来源列表，可能多于回答实际引用的来源。
- 展示网页搜索结果时要保留醒目的可点击引用，并检查原始页面；搜索不保证穷尽性或事实正确性。

## 简化与边界

- 示例聚焦文本 Web Search、`auto`/`required`、域名过滤和引用结构；不展开图片搜索、长时间 Deep Research、流式事件或 Chat Completions 搜索。
- `web_search` 的模型支持、参数、上下文和可用性可能变化；实施前以当时的 Web Search 指南和 API Reference 为准。
- 示例没有实际发送 Responses API 请求，也没有调用搜索工具。
