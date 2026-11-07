# 第 1 课：产品、模型、API、SDK 与应用

**目标：** 能解释一次 OpenAI API 调用中，应用、SDK、API 和模型各自负责什么。

## 本课问题

产品、模型、API、SDK 和我们自己写的应用，是不是同一个东西？它们怎样连起来？

## 官方资料

- [API Platform 文档](https://developers.openai.com/api/docs)：展示从 SDK 或 HTTP 发起请求、指定 `model` 和 `input`、读取响应的流程。
- [API Reference 总览](https://developers.openai.com/api/reference/overview)：说明 API surface、凭据、官方客户端库或直接 HTTP 调用，以及请求和响应 Schema。
- [SDKs and CLI](https://developers.openai.com/api/docs/libraries)：说明 SDK、CLI、Agents SDK 和 HTTP client 是不同的调用与开发方式。
- [API keys and service accounts](https://developers.openai.com/api/docs/guides/api-keys)：说明 API Key 是认证凭据，以及应用如何管理和保管凭据。

## 先建立这几个角色

| 名称 | 它负责什么 | 例子 |
| --- | --- | --- |
| OpenAI 产品/平台 | 提供可使用的产品和开发服务入口 | ChatGPT 面向用户使用；API Platform 让开发者将模型能力接入自己的应用 |
| 模型 | 根据请求输入生成结果，或使用请求中提供的能力 | 在请求的 `model` 字段中选择一个模型 ID |
| API | 规定应用怎样向 OpenAI 服务发送请求、接收响应 | Responses API 的 endpoint、请求字段和响应对象 |
| SDK | 用某种编程语言封装 API 调用细节 | TypeScript 代码调用 `client.responses.create(...)`；也可以自己发 HTTP 请求 |
| 应用 | 组织自己的界面、数据、业务规则，并决定怎样使用模型结果 | Cocos 游戏、游戏后端或其他业务服务 |

这里的关系图是本课程用于理解的简化模型：

```text
玩家
  ↕
Cocos 游戏客户端
  ↕ 你自己的业务接口
游戏后端（持有密钥、准备输入、调用 SDK 或 HTTP）
  ↓
OpenAI API（接收请求并返回响应）
  ↓
请求中指定的模型（根据 input 生成输出）
  ↑
后端读取结果并交给游戏业务
```

SDK 是应用调用 API 的一种方式。改用直接 HTTP 后，API 请求和模型并没有变成另一套服务。官方 API Reference 明确列出安装客户端库或直接调用 HTTP 两种方式。[API Reference 总览](https://developers.openai.com/api/reference/overview)

## 用一段伪代码看调用关系

```ts
const response = await client.responses.create({
  model: "当前要用的模型 ID",
  input: "请为玩家介绍这件装备。",
});

return response.output_text;
```

- `client.responses.create(...)`：SDK 暴露的客户端调用；底层会向 API 发请求。
- `model`：告诉 API 请求哪个模型。
- `input`：应用交给模型处理的输入。
- `response`：API 返回给应用的响应。
- `output_text`：示例中应用要呈现或继续处理的模型文本。

这段代码只展示关系，模型 ID 是占位说明，不能直接当成真实模型名称使用。实际模型名称和能力要查授课当日的模型目录。

## 放进游戏架构里

玩家向 NPC 提问时，游戏客户端可以把问题发给自己的后端。后端调用 OpenAI API，把结果筛选、保存或转换后再返回客户端。需要保密的 API Key 应放在服务端的环境或密钥管理系统里，不应放进浏览器、游戏客户端、移动应用或源码仓库。[API Reference 总览](https://developers.openai.com/api/reference/overview)、[API keys and service accounts](https://developers.openai.com/api/docs/guides/api-keys)

## 本课观察结果

看到一次调用，能按顺序说出：

1. **应用**准备输入并决定怎样处理结果。
2. **SDK 或 HTTP**负责发起 API 调用。
3. **API**接收请求并返回响应。
4. **模型**按请求中指定的模型 ID 处理输入。
5. **应用后端**负责保管 API Key 和连接游戏业务数据。

本课只梳理职责关系，不实际调用 API，也不需要 API Key。

## 练习

请把下面五个角色按调用顺序排好，并指出哪个角色负责保管 API Key：

`Cocos 客户端`、`游戏后端`、`SDK`、`OpenAI API`、`模型`

## 简化与边界

- OpenAI 产品和开发平台包含更多服务，本课只比较 ChatGPT 用户产品与开发者 API 的基本入口，不涉及订阅、计费或账户差异。
- SDK 帮助应用调用 API，但不会自动替应用设计业务流程、保管玩家数据或决定如何展示模型输出。
- API 负责服务请求和响应；模型的名称、能力、上下文窗口和可用性会随时间变化，后续模型课程再查当前目录。
