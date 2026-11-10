# 第 21 课：结构化输出如何帮助应用读取结果？

**目标：** 能用 JSON Schema 约束 Claude 的响应形状，区分响应 JSON 与工具输入约束，并指出结构化输出的 schema、拒答和截断边界。

## 本课问题

当应用需要读取固定字段时，为什么光在提示里说“请返回 JSON”不够？Messages API 如何指定响应结构？结果符合 schema 是否代表内容一定准确？

## 官方资料

- [Structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)：JSON 输出、严格工具使用、schema 子集、异常情况与兼容性。
- [Create a Message API Reference](https://platform.claude.com/docs/en/api/messages/create)：Messages 请求中的 output_config.format 字段。
- [Strict tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use)：用严格模式约束工具名称和输入参数，细节与第20课工具闭环相连。

核对日期：2026-11-10。结构化输出的模型/平台兼容性、schema 限制和 SDK helper 参数可能变化，使用前应核对当前文档。

## 1. 提示 JSON 与结构化输出

在普通文本提示中要求“只输出 JSON”，Claude 仍可能返回语法错误的 JSON、漏掉必需字段或改变字段类型。结构化输出把 JSON Schema 放入请求，由受约束解码将响应限制为符合 schema 的结构，便于下游程序解析。

它约束的是**输出结构**，不是应用业务规则或事实准确性。即使响应能通过 JSON 解析并符合字段类型，应用仍需判断分类、抽取结果或业务含义是否合理。

## 2. 在 Messages 请求中传入 JSON Schema

原始 Messages API 请求使用 output_config.format，type 为 json_schema，schema 中描述期望的字段。以下示意提取一封邮件的关键信息：

    {
      "model": "[当前可用模型 ID]",
      "max_tokens": 512,
      "messages": [
        {"role": "user", "content": "邮件：用户反馈被重复扣费，并要求核查。"}
      ],
      "output_config": {
        "format": {
          "type": "json_schema",
          "schema": {
            "type": "object",
            "properties": {
              "category": {"type": "string"},
              "summary": {"type": "string"},
              "urgent": {"type": "boolean"}
            },
            "required": ["category", "summary", "urgent"],
            "additionalProperties": false
          }
        }
      }
    }

在对象 schema 中列出 required 字段，并按官方结构化输出要求设置 additionalProperties 为 false。实际结果仍是 Messages 响应对象；JSON 文本位于 response.content 中的 text 内容块：

    {
      "category": "billing",
      "summary": "用户反映重复扣费，并要求核查。",
      "urgent": false
    }

应用可从 text 内容块读取文本，再用 JSON parser 解析为对象。若所用 SDK 提供 schema 或类型化解析 helper，可按其对应 SDK 文档使用；SDK helper 的便捷参数名可能与原始 API 字段路径不同。[Structured outputs: Quick start](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)

## 3. 响应格式与工具输入格式不是同一件事

| 能力 | 约束什么 | 请求位置或设置 | 适用例子 |
| --- | --- | --- | --- |
| JSON outputs | Claude 对用户返回的结构化响应。 | output_config.format，type 为 json_schema。 | 从邮件抽取字段、生成固定形状的报告。 |
| Strict tool use | Claude 调用工具时的工具名称和参数。 | tools 中的严格模式设置。 | 让工具参数符合 schema，再由应用执行工具。 |

两种能力可以单独使用，也可以在同一请求中结合：JSON outputs 控制 Claude 对外返回什么格式；Strict tool use 控制 Claude 怎样以符合 schema 的参数调用工具。第20课说明工具调用仍须由客户端应用按权限执行；严格的 JSON Schema 输入不会替代应用授权和副作用检查。[Structured outputs: Using both features together](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)

## 4. 结构化输出的边界

结构化输出使用受支持的 JSON Schema 子集，并非所有 JSON Schema 关键字都可用于约束解码。当前文档列出的限制包括：

- 不支持递归 schema 和外部 $ref。
- 不支持 minimum、maximum、multipleOf、minLength、maxLength 等数值或字符串长度限制。
- 数组的 minItems 仅支持 0 或 1；其他元素数量限制不支持。对象需要将 additionalProperties 设为 false。
- 复杂 schema 可能遇到语法编译耗时或复杂度限制；若遇到 API 400 错误，应检查官方限制或简化 schema。

SDK helper 可能把一些不支持的约束转换为字段描述，并在本地验证原始 schema；这不等于 API 收到并执行了每个 JSON Schema 约束。若业务规则要求数值范围或字符串长度，需由应用代码再次验证。[Structured outputs: JSON Schema limitations](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)

还要检查响应的停止原因：

- **refusal：** 安全拒答优先于 schema，响应可能不符合预期结构。
- **max_tokens：** 输出被长度上限截断时，JSON 可能不完整或不符合 schema。
- **字符串 enum/const 大小写：** 当前指南指出生成值的大小写不保证与 schema 逐字相同；不要依赖仅大小写不同的枚举区分。

因此，应用应先检查 stop_reason，再读取 text 内容块、解析 JSON，并对业务关键字段执行自己的校验。不能把 schema 约束当成对输出内容真实性或安全性的保证。[Structured outputs: Invalid outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)

## 练习：提取和验证

应用要从投诉文本中提取分类、摘要和紧急标记。请说明应把 schema 放在哪里，应该从响应的哪个位置读取 JSON，以及如何处理一次 refusal 或 max_tokens 结果。

**参考答案：** 在 Messages 请求的 output_config.format 中提供 type 为 json_schema 的 schema；从响应 content 的 text 内容块读取 JSON 文本并解析。先检查 stop_reason：refusal 时处理拒答，不能强求 JSON schema；max_tokens 时把结果当作可能截断，按当前文档调整输出上限或重试。正常解析后还应根据业务规则检查分类和紧急判断是否合理。

## 本课结论

JSON Schema 结构化输出让 Messages API 的响应更容易被程序稳定解析：通过 output_config.format 指定 JSON 格式和字段 schema，结果以 text 内容块中的 JSON 返回。它和 strict tool use 解决不同问题；schema 受 JSON Schema 子集限制，拒答或截断也可能破坏预期格式。解析成功只说明结构可读，不代表业务内容必然正确。

## 范围与时效

- 官方文档核对日期：2026-11-10。
- 本课只讨论 Messages API 的 JSON outputs 与 strict tool use 的区分；schema 关键字和兼容性以当前结构化输出文档为准。
- 工具执行闭环见第20课；图片和其他输入形式见第22课；输出质量评估见第26课。
