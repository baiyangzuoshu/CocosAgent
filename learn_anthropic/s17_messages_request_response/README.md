# 第 17 课：Messages 请求与响应由哪些部分组成？

**目标：** 能从请求的角色和内容读出 Claude 收到什么，并从响应内容块、结束原因、用量和请求标识判断返回了什么。

## 本课问题

一次 Messages API 调用不只是“输入一句话，返回一段文本”。请求中的角色和内容如何组织？响应为何会包含多个内容块？什么信息在 JSON body 中，什么信息在 HTTP headers 中？

## 官方资料

- [Using the Messages API](https://platform.claude.com/docs/en/build-with-claude/working-with-messages)：基础请求/响应示例、多轮结构和 system 指令位置。
- [Create a Message API Reference](https://platform.claude.com/docs/en/api/messages/create)：请求参数、Message 对象、内容块与字段类型。
- [Stop reasons and fallback](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons)：当前 stop_reason 值及常见含义。
- [API overview](https://platform.claude.com/docs/en/api/overview)：响应 headers，包括 request-id、组织 ID 和工作区 ID。
- [API versions](https://platform.claude.com/docs/en/api/versioning)：字段和枚举值如何随 API 版本演进。
- [Claude API errors](https://platform.claude.com/docs/en/api/errors)：错误响应、HTTP 状态和 request ID。

核对日期：2026-11-10。字段、内容块类型和 stop_reason 可能随 API 版本扩展；本课只列出当前常见结构。

## 1. 请求：模型、生成上限与消息历史

Messages API 的创建消息操作使用 POST /v1/messages。基础请求的主要字段如下：

| 字段 | 作用 | 要注意的点 |
| --- | --- | --- |
| **model** | 指定模型 ID。 | 可用 ID 与能力会变化；查 Models overview 和自己的访问条件。 |
| **max_tokens** | 设置本次生成输出的最大 token 数。 | 是上限，不是目标长度；模型可能提前结束。 |
| **messages** | 提供对话的消息列表。 | 每一项含 role 和 content。普通对话使用 user 与 assistant 轮次。 |
| **role** | 表明一条消息来自谁。 | user 表示用户侧输入；assistant 表示历史中的助手轮次，应用也可以按格式构造 assistant 消息。system 指令通常放在顶层 system 字段；部分模型支持符合放置规则的中途 system 消息，详见后续第18课。 |
| **content** | 表示消息正文。 | 可用字符串表示纯文本；也可用带 type 的内容块数组表示更复杂输入。 |

最小请求的形状：

    {
      "model": "[当前账户可用的模型 ID]",
      "max_tokens": 512,
      "messages": [
        {"role": "user", "content": "用一句话介绍海洋潮汐。"}
      ]
    }

在字符串内容的简写形式中，纯文本相当于一个 type 为 text 的内容块。图像、工具结果等内容通常需要按类型构造内容块；详细输入类型留到第20和22课。

## 2. 响应：Message 对象与内容块数组

成功的 Messages 请求返回一个 Message 对象。简化后的示意如下：

    {
      "id": "msg_example",
      "type": "message",
      "role": "assistant",
      "model": "[实际处理请求的模型 ID]",
      "content": [
        {"type": "text", "text": "海潮是海水受月球和太阳引力影响而产生的周期性涨落。"}
      ],
      "stop_reason": "end_turn",
      "stop_sequence": null,
      "usage": {
        "input_tokens": 18,
        "output_tokens": 16
      }
    }

这是教学用的字段示意，省略了其他可选字段。按字段读：

| 字段 | 通常表示什么 |
| --- | --- |
| **id** | 这条 Message 的唯一 ID；可用于识别或关联结果。 |
| **type** | 对 Message 对象通常为 message。 |
| **role** | 生成消息的角色为 assistant。 |
| **model** | 这次响应实际使用的模型 ID。 |
| **content** | 有序内容块数组；每个块通过自己的 type 描述结构。 |
| **stop_reason** | Claude 停止生成的原因。 |
| **stop_sequence** | 因自定义停止序列结束时，指出匹配的序列；其他情况通常为 null。 |
| **usage** | 用量统计，至少可看到输入和输出 token 数；新功能也可能带来更细的统计字段。 |

不要假设 content 一定只有一项，也不要把每个内容块都转成文字。普通回答常见 text block；调用工具时可能有 tool_use block；启用某些能力时还会出现其他类型。先看 type，再按该类型读取字段。完整类型以 [Create a Message API Reference](https://platform.claude.com/docs/en/api/messages/create) 为准。

## 3. stop_reason 说明“怎样停止”，不是请求是否成功

stop_reason 属于成功 Message 响应的 body，描述生成过程为什么停下；它不是 HTTP 状态码。当前官方指南列出这些常见值：

| stop_reason | 当前含义 | 阅读时的动作 |
| --- | --- | --- |
| **end_turn** | Claude 自然完成了本轮回答。 | 读取响应内容。 |
| **max_tokens** | 达到请求中的输出 token 上限。 | 检查是否被截断；视需要提高上限或延续。 |
| **stop_sequence** | 触发了请求中指定的停止序列。 | 查看 stop_sequence 字段。 |
| **tool_use** | Claude 返回了工具调用内容。 | 应用需按工具协议处理；完整闭环见第20课。 |
| **pause_turn** | 使用服务端工具时，执行回合被暂停。 | 按相应工具指南继续处理。 |
| **refusal** | Claude 拒绝执行请求。 | 如果有 stop_details，可查看其提供的拒绝类别。 |
| **model_context_window_exceeded** | 本次生成达到模型上下文窗口边界。 | 将结果视为可能不完整，并依据当前 API 指南处理。 |

即使 stop_reason 是 refusal，Messages API 也可能返回一个成功的 Message；它与 API 请求失败不是同一回事。HTTP 请求失败会返回错误状态和 error 对象。错误 body 通常包含 error.type、error.message 和 request_id。[Stop reasons and fallback](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons) · [Claude API errors](https://platform.claude.com/docs/en/api/errors)

API Reference 的枚举会演进。处理响应时，不要把未知 stop_reason 自动当作 end_turn；保留原值并走明确的兜底逻辑，再按当前文档更新支持的情况。[API versions](https://platform.claude.com/docs/en/api/versioning)

## 4. 用量与请求标识在不同位置

### Body 中的 usage

usage.input_tokens 和 usage.output_tokens 分别记录请求输入与生成输出的 token 统计。它们适合成本估算、配额分析和使用观察，不等于可见字符数量；启用缓存、思考或工具等功能时，响应可能包含更多用量细项。

### HTTP response headers

有些重要标识不在 Message JSON 中，而在 HTTP response headers：

| Header | 用途 |
| --- | --- |
| **request-id** | 唯一请求标识。排查特定调用或联系支持时提供；Python 和 TypeScript SDK 可从顶层响应对象的 _request_id 读取。 |
| **anthropic-organization-id** | 标识使用凭据所属的组织。 |
| **anthropic-workspace-id** | 标识凭据实际选中的工作区。 |

出现 JSON body 和响应头时，应分别读取，不要只保存 body 后丢掉请求标识。特定云平台可能另有自己的请求 ID，回看第14课对应的渠道说明。[API overview](https://platform.claude.com/docs/en/api/overview)

## 5. 用 SDK 按类型读取响应

以下示例只打印普通文本块，并显式显示结束原因与用量；它不尝试处理工具调用、流式事件或所有可选字段。

    response = client.messages.create(
        model="当前账户可用的模型 ID",
        max_tokens=512,
        messages=[{"role": "user", "content": "你好"}],
    )

    for block in response.content:
        if block.type == "text":
            print(block.text)
        else:
            print("需要按类型处理的内容块：", block.type)

    print("结束原因：", response.stop_reason)
    print("输入/输出 token：", response.usage.input_tokens, response.usage.output_tokens)
    print("请求 ID：", response._request_id)

如需读取组织或工作区等其他响应头，应使用 SDK 提供的原始响应接口或相应 accessor，具体以语言 SDK 文档为准。

## 练习：判断该看哪个字段

1. 一个成功响应带有 text 内容块，stop_reason 为 max_tokens。
2. 一个成功响应含 tool_use 内容块，stop_reason 为 tool_use。
3. 一个 HTTP 200 响应中的 stop_reason 为 refusal。
4. 请求返回 HTTP 错误，body 中有 error.type、error.message 和 request_id。
5. 运维希望联系 Anthropic 排查某次调用，但日志只存了 Message JSON。

**参考答案：**

1. 请求成功，但输出达到 max_tokens 上限；内容可能被截断。
2. 请求成功；应用需解析 tool_use 并依第20课完成工具闭环，不能把它当最终自然语言答案。
3. 这是成功的 Message 响应中的拒绝结果，不是 HTTP 请求错误；查看 stop_details（若有）。
4. 这是错误响应；按 HTTP 状态和 error 字段排查。
5. 还应保留 HTTP response headers 里的 request-id；Python/TypeScript SDK 可读取顶层响应对象的 _request_id。

## 本课结论

请求体用 model、max_tokens 和 messages 描述模型及对话；响应体通过 content 内容块、stop_reason 和 usage 描述生成结果；HTTP headers 另外提供 request-id 与组织/工作区标识。读取结果时先判断 HTTP 请求是否成功，再按内容块 type 和 stop_reason 处理，别把整个响应当作单一文本字段。

## 范围与时效

- 官方文档核对日期：2026-11-10。
- 课程列出的是当前常见字段和 stop_reason；实际响应随 API 版本、所选模型和启用功能而变化。
- 角色与 system 指令的组织方式留给第18课，工具调用闭环留给第20课，图片和其他输入形式留给第22课；错误处理留给第24课。
