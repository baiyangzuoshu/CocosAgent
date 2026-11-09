# 第 7 课：发出第一个 Responses API 请求

**目标：** 能读懂一个最小的 Responses API HTTP 请求和 TypeScript SDK 调用，知道输入从哪里发出、凭证在哪里使用、以及从响应中取出文本。

## 本课问题

一次最小的模型请求包含哪些部分？SDK 替我们做了什么？拿到响应后，文本在哪里？

## 前置知识

- [第 1 课](../s01_system_model_api_sdk_app/README.md)：模型、API、SDK 和应用各自的职责。
- [第 4 课](../s04_prompt_instructions_roles/README.md)：输入文本就是交给模型的任务内容。
- [第 5 课](../s05_model_selection/README.md)：请求需要指定一个当前可用、适合任务的模型。
- [第 6 课](../s06_projects_keys_authentication/README.md)：API Key 用于认证，必须留在服务端。

## 官方资料

- [Developer quickstart](https://developers.openai.com/api/docs/quickstart)：查看安装官方 SDK、设置凭证并发送第一次请求。
- [SDKs and CLI](https://developers.openai.com/api/docs/libraries)：查看服务端 JavaScript/TypeScript SDK 的安装和 Responses 示例。
- [Create a model response](https://developers.openai.com/api/reference/resources/responses/methods/create)：查看 `model`、`input` 等请求字段和返回对象。
- [API Overview](https://developers.openai.com/api/reference/overview)：查看 HTTP 认证和请求基本约定。

## 1. 一次请求的路线

```text
你的服务端程序
  ── HTTPS POST /v1/responses ──▶ OpenAI API
  ◀── JSON 响应 ────────────────
```

请求里最重要的部分是：

| 部分 | 作用 |
| --- | --- |
| `POST /v1/responses` | 请求 OpenAI 创建一次模型响应 |
| `Authorization: Bearer ...` | 提供服务端 API Key，完成请求认证 |
| `Content-Type: application/json` | 表示请求正文使用 JSON |
| `model` | 指定处理本次请求的模型 |
| `input` | 提供模型要处理的内容 |

`input` 可以是一个字符串；它相当于一条 `user` 消息的文本输入。模型名称会随时间变化，示例采用当前 Quickstart 中的 `gpt-6-astra`；实际使用前要确认模型在自己的 Project 中可用，并按任务重新选择。[Create a model response](https://developers.openai.com/api/reference/resources/responses/methods/create)、[模型指南](https://developers.openai.com/api/docs/models)

## 2. 先看 HTTP：请求实际发了什么

```bash
curl https://api.openai.com/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-6-astra",
    "input": "用一句话解释什么是 API。"
  }'
```

- URL 指向 Responses API 的创建端点。
- `Authorization` header 使用 shell 环境变量中的 Key；命令中没有写入 Key 的真实值。
- JSON 正文告诉 API 用哪个模型，以及要处理的输入。
- API 返回 JSON，其中包含响应状态和 `output` 项。

该请求必须从能安全读取 API Key 的服务端环境发出。不要把 Key 放进网页前端、移动客户端、公开代码或日志。请求会按当前 API 价格和账户规则计费；自己练习前确认 Project 和用量设置。[API keys and service accounts](https://developers.openai.com/api/docs/guides/api-keys)

## 3. 用 TypeScript SDK 发同一个请求

在服务端 JavaScript/TypeScript 项目中安装官方 SDK：

```bash
npm install openai
```

准备好 `OPENAI_API_KEY` 环境变量后，TypeScript 代码可以这样写：

```ts
import OpenAI from "openai";

const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-6-astra",
  input: "用一句话解释什么是 API。",
});

console.log(response.output_text);
```

SDK 默认从服务端环境变量 `OPENAI_API_KEY` 读取 Key。`client.responses.create(...)` 会替应用组装 HTTP 请求、处理 JSON 编解码，并返回有类型定义的响应对象。它没有替应用决定业务任务，也不会让 API Key 变成可以公开的值。[SDKs and CLI](https://developers.openai.com/api/docs/libraries)

OpenAI 的 JavaScript/TypeScript SDK Quickstart 用 `example.mjs` 展示了可直接运行的 JavaScript 形式；TypeScript 项目还需要使用项目已有的 TypeScript 编译器或运行时。SDK 的安装和 API 调用方式相同。[Developer quickstart](https://developers.openai.com/api/docs/quickstart)

## 4. 读懂结果：原始响应与 SDK 便捷属性

原始 HTTP JSON 的核心结构大致如下（具体输出内容和项目 ID 会因请求而异）：

```json
{
  "id": "resp_...",
  "object": "response",
  "status": "completed",
  "model": "gpt-6-astra",
  "output": [
    {
      "type": "message",
      "role": "assistant",
      "content": [
        {
          "type": "output_text",
          "text": "API 是程序之间按约定交换请求与结果的接口。"
        }
      ]
    }
  ]
}
```

本课先识别三个字段：

- `status`：响应当前状态；示例中是 `completed`。
- `output`：按项排列的输出内容。它是数组，不能假定第一个元素永远就是一段普通文本。
- `output_text`：SDK 提供的便捷属性，用于汇总文本输出；它不是原始 HTTP JSON 中的顶层字段。

因此，HTTP 客户端要按 JSON 响应结构读取 `output`；使用官方 SDK 时，纯文本入门示例可以读 `response.output_text`。响应也可能包含非文本输出、拒答或其他项目，后续课程会逐步拆解。[Create a model response](https://developers.openai.com/api/reference/resources/responses/methods/create)

## 观察练习

不需要先运行请求，先对照两种写法完成表格：

| 要素 | HTTP 版本 | SDK 版本 |
| --- | --- | --- |
| API 端点 | 待填写 | 由 SDK 处理 |
| 认证凭证 | `Authorization` header | 从 `OPENAI_API_KEY` 环境变量读取 |
| 模型与输入 | JSON 正文 | `responses.create()` 参数 |
| 读取生成的文本 | 查看响应 `output` 内的文本项 | `response.output_text` |

再说明：如果把模型名换成账户不可用的 ID，API Key 本身正确是否就一定能成功？为什么？

## 本课检查

完成本课后，能解释：

- 最小 Responses API 请求包含端点、认证 header 和含 `model`、`input` 的 JSON 正文。
- `input` 提供任务内容；`model` 选择处理任务的模型。
- SDK 封装 HTTP 与 JSON 处理，但请求仍会访问同一个 API，认证仍需要安全的凭证。
- 原始 API 响应用 `output` 数组表示输出；官方 JavaScript/TypeScript SDK 提供 `output_text` 便捷属性。
- 认证成功不代表模型、权限、用量或请求参数一定符合要求。

## 简化与边界

- 本课展示一个不带工具、图片或多轮状态的文本请求；响应完整结构和状态判断在第 8 课展开。
- `gpt-6-astra` 来自当前官方 Quickstart 示例。模型目录和 Project 可用性会变化，示例 ID 不是永久承诺。
- 文档示例只帮助理解请求格式；实际调用会按账户和 API 定价产生用量。本课没有代替你发送 API 请求。
- 本课 SDK 代码片段使用顶层 `await` 以突出 API 调用本身；运行时的 TypeScript 配置沿用具体项目设置。
