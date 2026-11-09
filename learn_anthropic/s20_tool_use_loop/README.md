# 第 20 课：工具调用如何形成完整闭环？

**目标：** 能描述工具定义、Claude 返回 tool_use、应用执行工具、tool_result 回传和 Claude 继续生成的完整过程，并区分由应用执行的工具与服务端工具。

## 本课问题

Claude 如何请求调用应用提供的工具？工具代码由谁执行？API 返回的工具调用内容怎样和执行结果对应？什么时候可以把响应当作最终答案？

## 官方资料

- [How tool use works](https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works)：工具执行位置、客户端工具循环与服务端工具循环。
- [Define tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools)：工具名称、说明、输入 JSON Schema 与调用行为设置。
- [Handle tool calls](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls)：读取 tool_use、组织 tool_result 和回传工具错误。
- [Create a Message API Reference](https://platform.claude.com/docs/en/api/messages/create)：tools、tool_choice、工具内容块与 stop_reason 字段。

核对日期：2026-11-10。工具类型、API 字段和 SDK 辅助能力可能变化；具体实现以所用模型、平台和当前文档为准。

## 1. 工具定义是接口约定

应用在请求的 tools 参数中声明可用工具。自定义客户端工具通常包含名称、说明和 input_schema：

    {
      "name": "lookup_order",
      "description": "按订单编号查询当前状态。只返回订单状态和预计送达日期，不修改订单。",
      "input_schema": {
        "type": "object",
        "properties": {
          "order_id": {
            "type": "string",
            "description": "用户提供的订单编号"
          }
        },
        "required": ["order_id"]
      }
    }

定义说明模型可以请求什么，以及参数应是什么形状；它不会把应用的查询代码发送给 Claude，也不会自动执行该代码。常见的 auto 选择方式允许 Claude 根据问题决定调用工具还是直接回答；应用也可以通过 tool_choice 控制选择方式。工具描述应清楚说明用途、适用条件、参数和限制。[Define tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools)

## 2. 客户端工具的完整往返

对于自定义工具或由应用执行的客户端工具，完整闭环如下：

    应用发送 tools 定义和对话
                 ↓
    Claude 返回 assistant 消息，其中含 tool_use
                 ↓
    应用按名称分派工具，检查参数并执行
                 ↓
    应用以 user 消息中的 tool_result 回传结果
                 ↓
    Claude 依据工具结果继续生成
                 ↓
    若再次返回 tool_use，应用重复处理；否则按 stop_reason 处理响应

请求工具时，Claude 的 assistant 响应会包含一个或多个 tool_use 内容块。块中有本次调用的 id、工具 name 和结构化 input；响应的 stop_reason 通常是 tool_use。这是模型提出了调用请求的信号，不代表工具已经运行，也不代表用户要求的动作已经完成。

工具执行后，应用在后续请求中保留此前的消息历史和 assistant 工具调用响应，再增加一条 user 消息，其中的 tool_result 用 tool_use_id 指向对应的调用，并放入真实执行结果：

    assistant 响应中的调用：
      {"type": "tool_use", "id": "toolu_example", "name": "lookup_order", "input": {"order_id": "A-1042"}}

    后续请求中的结果消息：
      {
        "role": "user",
        "content": [
          {"type": "tool_result", "tool_use_id": "toolu_example", "content": "状态：已发货；预计周五送达。"}
        ]
      }

tool_use_id 必须对应 Claude 返回的那一个 tool_use id。工具结果应紧接该 assistant 工具调用消息回传；如果同一响应有多个客户端工具调用，就要为每个调用返回匹配的结果块。结果消息应先放 tool_result 内容块，再放任何额外文本；在 server tool 尚未完成的特定组合场景中，格式要求更严格，需按专门文档处理。[Handle tool calls](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls)

收到结果后，Claude 可能给出最终答复，也可能请求下一项工具。应用围绕 stop_reason 继续循环，直至工具闭环结束或需要按其他停止原因处理。[How tool use works](https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works)

## 3. 谁来运行工具？

| 工具类型 | 代码由谁执行 | 常见结果路径 |
| --- | --- | --- |
| 自定义客户端工具 | 应用自己的后端或客户端代码。 | Claude 返回 tool_use；应用执行并用 tool_result 回传。 |
| Anthropic schema 的客户端工具 | 应用仍负责执行，例如 bash、text editor、computer/browser 一类客户端工具。 | 和自定义客户端工具类似，需处理调用并回传结果。 |
| 服务端工具 | Anthropic 服务端，例如 web search、web fetch 或 code execution。 | 常见情况下服务端自己完成执行与结果回填，应用读取响应，不自行伪造 tool_result。 |

工具的执行位置决定谁拥有执行权限和运行责任。服务端工具的暂停、与客户端工具同时调用等情况有额外流程；本课的主要闭环针对客户端工具。[How tool use works](https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works)

## 4. 工具失败与应用侧检查

客户端工具执行失败时，应用可以把错误内容作为对应 tool_result 回传，并设置 is_error 为 true。Claude 随后可以据此解释失败、改用别的工具或请求更多信息。错误回传让模型知道操作失败，但不会替应用自动重试外部操作；重试规则应由应用结合错误类型和操作性质决定。[Handle tool calls: errors](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls)

应用也需要把模型产生的 input 当作待验证的调用参数，而不是权限凭证：

1. 校验工具名称、必需字段、字段类型、取值范围与对象权限。
2. 对改记录、发消息、支付等副作用操作，按应用规则做授权检查；必要时增加用户确认步骤。
3. 对可能反复请求工具的对话设置应用侧调用上限、超时和日志，避免错误循环放大副作用或成本。
4. 把网页、邮件、文件或第三方 API 的结果作为工具结果数据处理，不把其中出现的指令转成 system 指令。

以上是应用在工具边界上的工程责任，不是 API 会替应用执行的安全保证。尤其是工具结果可能包含外部不可信文本；Anthropic 建议保留在 tool_result 中，并按提示注入风险处理。[Handle tool calls](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls)

## 练习：追踪一次天气查询

用户问：“上海现在下雨吗？”应用提供 get_weather 工具。Claude 返回了一个 tool_use，id 为 toolu_weather_1，input 中 location 为“上海”。请按时间顺序写出应用应做的事情，并说明何时可以把结果作为给用户的答案。

**参考答案：** 应用收到 stop_reason 为 tool_use 的 assistant 消息，检查调用名称及 location 参数，依据应用权限调用天气服务；将真实查询结果放在 tool_result 中，并用 tool_use_id 关联 toolu_weather_1；随后把原对话、assistant 工具调用消息和 user 工具结果消息一起发给 Messages API。Claude 返回最终自然语言答案并以 end_turn 结束时，应用才将其作为本轮答复；若继续出现 tool_use，继续闭环；若工具出错则回传标记错误的结果并按 stop_reason 和应用策略处理。

## 本课结论

工具调用不是模型直接执行应用代码：模型在 assistant 响应中提出结构化 tool_use；对客户端工具，应用验证并执行后，再以 tool_use_id 对应的 tool_result 回传；Claude 读取结果后继续生成。应用应检查停止原因和调用参数、处理错误并守住权限与副作用边界。服务端工具由 Anthropic 运行，执行结果路径不同，不能混用客户端工具的回传方式。

## 范围与时效

- 官方文档核对日期：2026-11-10。
- 本课描述 Messages API 客户端工具的基本闭环，并概览客户端与服务端工具的执行边界。
- 多个工具的并行策略、流式工具调用、SDK Tool Runner、MCP Connector 和生产环境权限设计留给各自专题；服务端工具的暂停与混合调用按当前官方指南处理。
