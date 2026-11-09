# 第 9 课：让模型按 Schema 返回结构化数据

**目标：** 能说明 Structured Outputs 解决什么问题，会在 Responses API 请求中声明 JSON Schema，并知道怎样处理拒答、不完整输出和 Schema 限制。

## 本课问题

如果应用需要从模型输出中读取固定字段，怎样减少格式错误？结构符合 Schema 是否代表内容一定正确？

## 前置知识

- [第 4 课](../s04_prompt_instructions_roles/README.md)：Prompt、指令与消息角色。
- [第 7 课](../s07_first_responses_request/README.md)：Responses API 最小请求。
- [第 8 课](../s08_responses_request_response/README.md)：读取 `output`、响应状态和 Token 用量。

## 官方资料

- [Structured model outputs](https://developers.openai.com/api/docs/guides/structured-outputs)：查看 Responses API `text.format`、JSON Schema、严格模式与边界情况。
- [Create a model response](https://developers.openai.com/api/reference/resources/responses/methods/create)：查看 `text.format` 的请求结构和 JSON Schema 字段。
- [Text generation](https://developers.openai.com/api/docs/guides/text)：复习普通文本输出与 `output_text`。

## 1. 为什么只写 Prompt 不够

让模型“请用 JSON 回答”是在告诉它期望的格式，但没有定义程序可依赖的字段、类型和枚举取值。输出可能缺少字段、把数字写成文字，或使用程序不认识的分类值。

Structured Outputs 允许在请求中提交 JSON Schema，让模型的结构化响应遵循该 Schema。常见方案的差别是：

| 方式 | 能约束什么 |
| --- | --- |
| 普通 Prompt | 只用自然语言描述期望；结构没有 Schema 保证 |
| JSON mode（`json_object`） | 通常输出有效 JSON，但不保证符合指定字段结构；仍需处理文档列出的边界情况 |
| Structured Outputs（`json_schema`） | 输出按支持的 JSON Schema 约束结构 |

官方指南建议在支持的场景优先使用 Structured Outputs。它约束的是结构，不会证明模型填写的内容真实、完整或符合业务含义。[Structured model outputs](https://developers.openai.com/api/docs/guides/structured-outputs)

## 2. 定义 Schema 并放进 Responses 请求

下面的例子从一条待办事项中提取标题、优先级和标签。`strict: true` 开启严格 Schema 遵循：

```ts
const response = await client.responses.create({
  model: "gpt-6-astra",
  input: "提取待办：周五前完成登录页；这是高优先级，标签为前端和发布。",
  text: {
    format: {
      type: "json_schema",
      name: "task_summary",
      strict: true,
      schema: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "待办事项标题",
          },
          priority: {
            type: "string",
            enum: ["low", "normal", "high"],
          },
          tags: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["title", "priority", "tags"],
        additionalProperties: false,
      },
    },
  },
});
```

Responses API 在 `text.format` 中接收格式配置。`type: "json_schema"` 选择 Schema 模式，`name` 标识这个格式，`schema` 定义可返回的数据形状，`strict: true` 要求严格匹配受支持的 Schema 子集。[Create a model response](https://developers.openai.com/api/reference/resources/responses/methods/create)

上面的 `required` 列出所有字段，`additionalProperties: false` 禁止对象带上未声明的键。严格模式下，每个对象都要列出 `required` 和设置 `additionalProperties: false`。需要表达可空值时，可用包含 `null` 的联合 Schema，而不是省略属性。[Structured Outputs：Supported schemas](https://developers.openai.com/api/docs/guides/structured-outputs)

## 3. 从响应读取 JSON，再映射为 TypeScript 类型

在这个文本输出模式下，SDK 的 `response.output_text` 是 JSON 文本。`JSON.parse` 将它转成 JavaScript 值：

```ts
type TaskSummary = {
  title: string;
  priority: "low" | "normal" | "high";
  tags: string[];
};

const refused = response.output.some(
  (item) =>
    item.type === "message" &&
    item.content.some((part) => part.type === "refusal"),
);

if (response.status !== "completed" || refused) {
  if (refused) throw new Error("模型拒绝了本次请求");
  throw new Error(`Response 未完成：${response.status}`);
}

const task = JSON.parse(response.output_text) as TaskSummary;
console.log(task.priority, task.title, task.tags);
```

JSON Schema 约束模型要返回的结构；TypeScript 的 `TaskSummary` 只在编译时提供类型提示。`as TaskSummary` 本身不会在运行时检查数据。如果应用还会接收其他来源的数据，应再用运行时校验库核验数据。

如果请求因为安全原因被拒绝，响应内容可能带有 `refusal`，而不符合你提供的 Schema；如果输出到达 Token 上限等原因而不完整，也不能直接假设 `output_text` 是可解析的完整对象。在解析和使用数据前，检查响应状态，并处理拒答和不完整情况。[Structured Outputs：Refusals](https://developers.openai.com/api/docs/guides/structured-outputs)

## 4. Schema 负责结构，业务代码仍要判断含义

即使返回数据满足 Schema，也仍需检查它是否能用于当前业务：

- Schema 可以限制 `priority` 只能是 `low`、`normal` 或 `high`，但无法保证模型正确判断了原文的真实优先级。
- Schema 可以要求 `title` 是字符串，但不能保证标题准确表达用户原意。
- 日期、权限、价格和数据库状态等关键数据，应由应用的业务规则或可信数据源验证。
- 严格模式只支持 JSON Schema 的一个子集；不支持的 Schema 可能导致请求报错。需要按官方支持范围设计，并对真实任务进行评估。

如果目标是让模型输出给应用或用户消费的数据，可用 `text.format`。如果目标是让模型选择并调用应用函数，则属于 Function Calling 的任务，后续工具课程再展开。[Structured Outputs：何时使用 `text.format`](https://developers.openai.com/api/docs/guides/structured-outputs)

## 观察练习

观察上面的 Schema，回答：

1. `priority` 为什么不能返回 `urgent`？
2. 如果响应的 `status` 是 `incomplete`，代码为什么不应直接 `JSON.parse`？
3. `as TaskSummary` 会不会在运行时验证数据？
4. Schema 符合格式后，是否就能认定模型提取出的优先级符合原文？

再试着设计一个 `contact` Schema，包含必填的姓名、邮箱和 `source` 字段；`source` 只能是 `email`、`phone` 或 `web`。为每个对象设置 `additionalProperties: false`，并将所有字段列入 `required`。

## 本课检查

完成本课后，能解释：

- Prompt 约定、JSON mode 和 Structured Outputs 的约束能力不同。
- Responses API 使用 `text.format` 声明 `json_schema`；严格模式通过 `strict: true` 启用。
- Schema 对象在严格模式下要声明所有 `required` 属性，并设置 `additionalProperties: false`。
- 拒答和不完整响应是正常的边缘情况，应先检查状态和拒答信息，再解析。
- Schema 保证结构约束，不保证事实正确或业务规则成立；TypeScript 类型断言也不做运行时校验。

## 简化与边界

- 示例使用手写 JSON Schema，不展开 Zod 等 SDK 辅助工具；官方指南也提供 SDK 对象 Schema 的用法。
- 严格模式支持 JSON Schema 的子集；复杂 Schema 需核对官方支持列表。
- 模型 ID 和 Structured Outputs 的模型支持范围可能变化，部署前以当前模型文档和项目可用性为准。
- 本课没有实际发送 API 请求。
