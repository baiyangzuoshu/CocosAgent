# 第 30 课：Agent 怎样定义自定义工具并处理执行结果？

**目标：** 能定义一个边界清楚的自定义函数工具，说明参数 Schema、应用执行逻辑和工具结果各自负责什么，并能比较 Responses API、Agents SDK 与 Agents API 的调用和回传方式。

## 本课问题

给 Agent 一个 `lookup_order` 工具后，模型到底负责哪一步？真实业务函数在哪里运行？调用结果怎样回到 Agent，让它继续完成任务？

## 前置知识

- [第 20 课](../s20_function_calling_loop/README.md)：理解模型发出函数调用请求、应用执行和结果回传。
- [第 28 课](../s28_single_agent_configuration/README.md)：理解 Agent 配置中的工具列表。
- [第 29 课](../s29_agent_run_loop/README.md)：理解工具结果如何进入运行循环并继续运行。

## 官方资料

- [Function calling](https://developers.openai.com/api/docs/guides/function-calling)：复习函数工具的定义、参数和 Responses API 往返过程。
- [Agents SDK：Tools](https://openai.github.io/openai-agents-js/guides/tools/)：查看 TypeScript `tool()`、Schema 验证和 `execute`。
- [Agents SDK：Running agents](https://openai.github.io/openai-agents-js/guides/running-agents/)：查看 `run()` 如何完成 Agent 运行并返回最终输出。
- [Agents API：Functions](https://developers.openai.com/api/docs/guides/agents-api/tools/functions)：查看自定义函数定义、待处理调用和结果回传。
- [Agents API：Run and continue sessions](https://developers.openai.com/api/docs/guides/agents-api/sessions)：复习 Session 与 Turn 的运行方式。

## 1. 自定义工具由“调用约定”和“应用实现”组成

自定义函数工具让模型可以请求应用代码完成一项工作。工具定义告诉模型函数名称、用途和参数形状；函数实现负责访问应用数据或服务，并返回结果。定义工具不会把函数代码、数据库权限或业务数据交给模型。Agents API 文档也明确说明，函数处理代码运行在应用服务、Worker 或开发者控制的环境中；把执行环境附加到 Session 并不会自动执行这些函数。[Agents API：Functions](https://developers.openai.com/api/docs/guides/agents-api/tools/functions)

| 部分 | 主要作用 | 例子：`lookup_order` |
| --- | --- | --- |
| `name` | 稳定标识要调用的能力 | `lookup_order` |
| `description` | 让模型理解什么时候适合调用、能力有什么边界 | 只读查询当前用户有权查看的订单状态 |
| `parameters` | 描述并验证模型提供的参数形状 | 必须提供字符串 `orderId` |
| 执行函数 | 由应用检查业务条件并访问真实服务 | 核对订单归属，再查询状态 |
| 返回结果 | 为模型提供继续判断所需的最少事实 | `{ found: true, status: "shipped" }` |

**Schema 不是权限系统。** 参数符合 Schema 只代表数据形状合格，不代表调用者有权访问指定资源，也不代表该业务动作允许执行。授权和业务规则应放在应用可信的执行逻辑中。

## 2. 在 Agents SDK 中实现一个只读函数

下面的 TypeScript 例子用固定对象模拟订单服务。它演示 `tool()`、Zod 参数 Schema、`execute` 中的资源授权检查，以及 Runner 如何在工具结果返回后继续运行。[Agents SDK：Tools](https://openai.github.io/openai-agents-js/guides/tools/) · [Running agents](https://openai.github.io/openai-agents-js/guides/running-agents/)

```ts
import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";

const orders: Record<string, { ownerId: string; status: string }> = {
  "ORD-1001": { ownerId: "user_demo", status: "shipped" },
};

// 教学用的身份固定值。真实应用应从已验证的登录状态或服务端上下文取得。
const currentUserId = "user_demo";

const lookupOrder = tool({
  name: "lookup_order",
  description: "只读查询当前用户有权查看的订单状态。",
  parameters: z.object({
    orderId: z.string().describe("订单编号，例如 ORD-1001。"),
  }),
  async execute({ orderId }) {
    if (!/^ORD-\d+$/.test(orderId)) {
      return { found: false };
    }

    const order = orders[orderId];
    if (!order || order.ownerId !== currentUserId) {
      // 对模型统一返回未找到，避免暴露其他用户的订单是否存在。
      return { found: false };
    }

    return {
      found: true,
      orderId,
      status: order.status,
    };
  },
});

const orderAgent = new Agent({
  name: "Order status helper",
  instructions:
    "Help users check order status. Use lookup_order for order facts. " +
    "If found is false, say the order could not be found.",
  tools: [lookupOrder],
});

const result = await run(orderAgent, "请查询 ORD-1001 是否已经发货。");
console.log(result.finalOutput);
```

执行时，Agents SDK 会把工具 Schema 提供给模型，并在模型提出调用后验证参数，再调用 `execute`。函数返回的对象会序列化后提供给模型；`run()` 管理后续运行循环，最终在结果中给出 `finalOutput`。[Agents SDK：Tools](https://openai.github.io/openai-agents-js/guides/tools/) · [Running agents](https://openai.github.io/openai-agents-js/guides/running-agents/)

这里的 `orders` 和 `currentUserId` 都是演示值，代码没有连接订单服务。真实应用要从受信任的身份上下文取得用户身份，并在读取或写入具体资源前执行授权。不要把用户身份当作模型可以自行填写的函数参数。

## 3. 三种入口怎样执行并回传同一个函数结果

函数能力和运行时的分工不同。先确定由谁执行函数，再按该入口的协议回传结果。

| 入口 | 函数在哪里实现、执行 | 怎样把结果交回运行流程 |
| --- | --- | --- |
| Responses API | 应用代码读取 `function_call`，按名称调用本地或服务端函数 | 以 `function_call_output` 携带原来的 `call_id`，然后继续请求模型；完整往返见[第 20 课](../s20_function_calling_loop/README.md) |
| Agents SDK | 应用在 `tool()` 的 `execute` 中实现函数；Runner 负责调度、执行、继续模型循环 | SDK 将函数结果带回 Agent；应用读取 Run Result 中的最终输出或异常 |
| Agents API | Agent 定义提供函数 Schema；应用服务或 Worker 执行函数 | Session 发出 `agent.session.requires_action` 后，应用读取 `required_actions` 并提交 `agent.session.input.tool_result` |

在 Agents API 中，待处理调用包含 `turn_id`、`call_id`、函数名称和参数。应用回传时必须从同一个待处理动作复制 `turn_id` 与 `call_id`。成功结果使用 `success: true` 和 `output`；JSON 对象应序列化成字符串。执行失败时可用 `success: false` 和 `error` 提交可供 Agent 理解的错误信息。收到待处理结果后，Harness 会继续该 Turn。[Agents API：Functions](https://developers.openai.com/api/docs/guides/agents-api/tools/functions)

要根据 `required_actions` 判断哪些函数确实还需要处理。历史记录里曾出现 `function_call`，不等于它现在仍是待执行调用。若连接中断，先重新检查 Session 中的待处理动作；对于有副作用的操作，应按 Session、Turn 和调用 ID 持久记录执行结果，并检查此前是否已成功，避免断线后重复操作。[Agents API：Functions](https://developers.openai.com/api/docs/guides/agents-api/tools/functions)

## 4. 用四个问题检查自定义工具

1. **它只做一件什么事？** 名称和说明要让模型选择正确工具，避免含糊的 `do_action` 或范围过大的万能函数。
2. **参数怎样被验证？** Schema 约束类型和结构；业务格式、状态流转和资源关系仍要由应用代码检查。
3. **调用者有权访问目标吗？** 从受信任上下文核对用户身份与资源归属；不能依赖模型指令或工具描述完成授权。
4. **返回什么才够？** 只回传 Agent 下一步需要的字段；过滤密钥、个人信息和无关的大段内部数据，并明确可恢复的业务错误。

只读查询可以直接返回经过筛选的结果。更新订单、退款、发信和删除等副作用工具则还需要幂等、重试恢复和必要的人工审批；人工审批会在第 35 课展开。

## 观察练习

把 `lookup_order` 改成一个“申请取消订单”的工具，先写设计，不要执行真实操作：

| 项目 | 你的设计 |
| --- | --- |
| 函数名称和一句话说明 | 待填写 |
| 必要参数及其 Schema | 待填写 |
| 从哪里取得当前用户身份 | 待填写 |
| 哪些订单状态允许取消 | 待填写 |
| 怎样防止同一请求重试时重复取消 | 待填写 |
| 成功与失败时返回哪些字段 | 待填写 |

## 本课检查

完成本课后，能解释：

- 工具 Schema 是模型可见的调用契约；`execute` 或应用服务实现实际业务能力。
- Agents SDK 的函数工具把应用函数包装成模型可调用的工具；Runner 可以继续运行并返回最终输出。
- Responses API、Agents SDK 和 Agents API 对函数运行与结果回传各有不同协议，但函数仍要由相应应用或执行环境完成。
- Schema 验证不等同身份验证、资源授权或业务规则检查。
- Agents API 用待处理 action 的 `turn_id` 与 `call_id` 关联结果；有副作用的函数还要考虑持久化与重复调用。

## 简化与边界

- 示例只展示一个只读查询、一个演示用户和固定订单数据；没有安装 SDK、访问数据库或发送 API 请求。
- 示例省略了函数超时、并发、输出 Schema、业务错误策略、持久化与审批实现；这些需要按实际 SDK/API 版本和业务风险设计。
- Agents SDK、Responses API 与 Agents API 的字段名称和状态细节不能互相替换；实际实现应跟随对应入口的最新官方指南。
