# 第 28 课：一个单 Agent 由哪些配置组成？

**目标：** 能解释单 Agent 的模型、指令、工具与最终输出格式分别控制什么；能区分工具参数结构和 Agent 最终结果结构。

## 本课问题

定义一个 Agent 时，哪些设置决定它能做什么、如何做，以及最终把什么交给应用？

## 前置知识

- [第 9 课](../s09_structured_outputs/README.md)：了解 Structured Outputs 与 JSON Schema。
- [第 20 课](../s20_function_calling_loop/README.md)：理解模型提出工具请求、应用执行和结果回传。
- [第 27 课](../s27_choose_agent_runtime/README.md)：区分 Responses API、Agents SDK 和 Agents API 的运行方式。

## 官方资料

- [Agents SDK：Agent definitions](https://developers.openai.com/api/docs/guides/agents/define-agents)：查看单 Agent 的模型、指令、工具和结构化输出配置。
- [Agents API：Configuring Agents](https://developers.openai.com/api/docs/guides/agents-api/configuration)：查看 Agents API 的模型、指令、工具、推理和输出设置。
- [Agents SDK：Models and providers](https://developers.openai.com/api/docs/guides/agents/models)：了解模型与模型设置的选择。
- [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)：区分结构化输出、JSON mode 和 function calling。

## 1. Agent 配置是一份可复用的工作说明

单 Agent 配置描述一个 Agent 的职责、可用能力和响应方式。它不是这一次用户消息，也不是 Agent 的运行记录：**配置定义怎么工作，输入说明这次要做什么，Session 或运行状态记录工作过程。** SDK 与 Agents API 的具体字段名称和保存方式不同，但基本概念相通。[Agent definitions](https://developers.openai.com/api/docs/guides/agents/define-agents) · [Configuring Agents](https://developers.openai.com/api/docs/guides/agents-api/configuration)

| 配置部分 | 它回答的问题 | 常见选择 |
| --- | --- | --- |
| 名称 | 这个 Agent 是谁？ | 用清楚、可识别的名称，便于日志、Trace 和工具界面辨认 |
| 模型 | 由哪个模型完成判断与生成？ | 按任务难度、质量、延迟、成本和模型支持的功能选择 |
| 指令 | 它负责什么、应遵守什么约束？ | 写明职责、工作规则、缺少信息时的处理方式和回答要求 |
| 工具 | 它可以使用哪些外部能力？ | 只开放完成任务需要的查询、函数或托管工具 |
| 输出格式 | 完成后交给调用方什么形状的数据？ | 面向用户的自然语言，或供程序消费的结构化数据 |

单 Agent 的目标是先让一个职责清楚的专家完成一个范围明确的任务。暂时不必在配置里加入多个 Agent、Handoff 或复杂运行控制。[Agent definitions](https://developers.openai.com/api/docs/guides/agents/define-agents)

## 2. 分别理解四个核心设置

### 模型：决定使用哪种模型能力

模型参与解释输入、决定是否使用已开放的工具，以及生成结果。选择时要考虑任务的推理难度、质量要求、延迟和成本，并确认目标模型支持实际使用的工具与输出模式。模型名称、能力和访问权限会变化，开始实现前要重新核对官方模型资料；模型比较方法见[第 5 课](../s05_model_selection/README.md)。

模型不是 Agent 的任务说明，也不会自动获得应用的数据或权限。

### 指令：定义职责和行为约束

指令通常说明：

- Agent 的目标与职责边界。
- 怎样判断是否已有足够信息，何时先向用户追问。
- 使用工具时应遵守什么规则，以及回答应采用什么风格。
- 工作何时算完成，无法继续时怎样说明或停止。

指令应该简洁、具体，并和实际可用工具一致。写上“查询订单”并不会自动创建数据库连接；如果没有相应工具，Agent 就没有这项能力。敏感操作的实际权限也要由工具实现和应用侧控制，不能只靠一句指令限制。

### 工具：定义可采取的动作

`tools` 表示 Agent 可调用的能力，例如第 20 课的应用函数、第 21 课的内置工具，或第 25 课的 MCP 服务。工具配置让模型知道工具叫什么、什么时候使用、需要哪些参数；具体代码由应用或相应运行环境执行。

工具列表就是能力边界的一部分。只提供完成当前任务所需的工具；逐个工具的参数、执行逻辑和结果处理将在第 30 课展开。

### 输出格式：约定最终结果的形状

如果结果直接展示给用户，普通文本通常够用。如果下游程序要根据结果更新界面、保存字段或进入确定流程，就可以要求模型按 JSON Schema 生成结构化输出。Structured Outputs 约束输出符合 schema；它不保证字段内容一定正确，也不能代替业务校验。[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)

注意区分两种结构：

| Schema | 约束什么 | 例子 |
| --- | --- | --- |
| 工具参数 schema | 模型传给某个工具的调用参数 | `lookup_order` 必须收到一个字符串 `orderId` |
| 最终输出 schema | Agent 最后交给应用或用户的数据 | 订单状态、说明和建议下一步 |

这两者可以同时存在，但作用完全不同。函数调用是让 Agent 请求执行动作；最终输出格式是约定任务结果如何表示。[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)

## 3. 配置示例：只查询订单状态

下面用 Agents SDK 的 TypeScript 写法展示配置之间的关系。工具函数返回固定示例数据，不会连接真实订单系统；`gpt-6-astra` 也只是示例模型名，实际应按当前可用模型和任务评估选择。

```ts
import { Agent, tool } from "@openai/agents";
import { z } from "zod";

const lookupOrder = tool({
  name: "lookup_order",
  description: "Read the status of an order using its ID.",
  parameters: z.object({ orderId: z.string() }),
  async execute({ orderId }) {
    return { orderId, status: "shipped" };
  },
});

const orderOutput = z.object({
  orderId: z.string(),
  status: z.enum(["shipped", "not_found"]),
  customerMessage: z.string(),
});

const orderAgent = new Agent({
  name: "Order status helper",
  model: "gpt-6-astra",
  instructions:
    "Help users check order status. Ask for an order ID if it is missing. " +
    "Use only the lookup_order result when stating the status.",
  tools: [lookupOrder],
  outputType: orderOutput,
});
```

在这个例子中，`parameters` 是 `lookup_order` 的输入 schema；`outputType` 是 Agent 最后结果的 schema。工具代码在 `execute` 中运行，模型不会因为看到 schema 就直接访问订单数据库。SDK 的 TypeScript 字段使用 `outputType`；Python Agents SDK 使用 `output_type`。Agents API Agent 配置通过 `text.format` 指定输出格式，Responses API 则在具体响应请求中设置 `text.format`；不能把一个入口的字段名原样复制到另一个入口。[Agent definitions](https://developers.openai.com/api/docs/guides/agents/define-agents) · [Create an agent](https://developers.openai.com/api/reference/typescript/resources/beta/subresources/agents/methods/create) · [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)

## 4. 用“最小配置”检查设计

为一个 Agent 定义配置时，可以依次写出：

1. 它负责完成哪一种明确任务？
2. 哪些模型能力和质量要求影响模型选择？
3. 哪几条稳定规则必须写进指令？
4. 它真正需要哪些工具？每个工具由谁执行？
5. 调用方要自然语言，还是要结构化字段？
6. 使用结构化输出时，应用还要做哪些事实或业务规则检查？

如果某个字段还说不清楚，先缩小 Agent 的职责或输出要求，再考虑增加配置。

## 观察练习

给“从用户提交的发票文字中提取供应商名称、日期和总金额”的单 Agent 写下配置草案：

| 配置项 | 你的决定 |
| --- | --- |
| Agent 名称 | 待填写 |
| 模型选择时要看什么 | 待填写 |
| 指令中的职责和约束 | 待填写 |
| 是否需要工具；若需要，开放什么能力 | 待填写 |
| 最终输出格式与字段 | 待填写 |

再回答：如果输出要供程序导入，应该把字段要求放在哪个 schema？如果模型需要查询数据库，数据库查询参数又属于哪个 schema？

## 本课检查

完成本课后，能解释：

- 模型负责语言理解和生成；指令描述 Agent 的任务和行为；工具提供可执行的外部能力；输出格式约定最终结果结构。
- Agent 配置与当前任务输入、Session 对话状态是不同概念。
- 工具参数 schema 限制一次工具调用的输入；最终输出 schema 限制 Agent 最后返回的数据结构。
- Structured Outputs 保证的是结构约束，不代表事实或业务规则自动正确。
- 不同入口的配置字段名和对象结构可能不同；实现时要查对应 SDK/API 的最新文档。

## 简化与边界

- 本课只覆盖单 Agent 的基础配置；不展开 Session、运行循环、自定义工具完整执行过程、护栏、审批和 Handoff。
- 示例采用 Agents SDK TypeScript 语法，展示配置形状，不是完整应用；工具返回固定演示数据，没有安装 SDK 或发送 API 请求。
- `model`、`outputType` 及 Structured Outputs 支持情况可能随模型和 SDK 版本变化；实现前应核对对应官方参考。
