# 第 18 课：system 指令、消息角色与上下文如何组织？

**目标：** 能区分应用指令、用户输入和 assistant 历史内容，理解 top-level system 与 messages 的位置，并识别特定模型支持的中途 system 消息边界。

## 本课问题

一次 Messages API 请求中的指令和对话内容分别放在哪里？user、assistant、system 这些角色怎样区分？应用如何决定 Claude 本轮能看到哪些上下文？

## 官方资料

- [Using the Messages API](https://platform.claude.com/docs/en/build-with-claude/working-with-messages)：基础请求、多轮消息和 system 指令的组织方式。
- [Create a Message API Reference](https://platform.claude.com/docs/en/api/messages/create)：system 参数、消息列表、角色与内容字段。
- [Mid-conversation system messages](https://platform.claude.com/docs/en/build-with-claude/mid-conversation-system-messages)：特定模型支持的中途 system 指令、位置要求和适用边界。

核对日期：2026-11-10。消息能力及模型支持范围可能变化；使用中途 system 消息前，应查阅当前文档和目标模型要求。

## 1. 请求里的指令与消息列表

基础请求中，应用级指令通过顶层 system 字段提供；有序的 messages 列表描述这次交互中要交给模型的对话消息。每条消息包含 role 和 content：role 标示消息类型或来源，content 携带文本或其他内容块。

    {
      "system": "请用简洁中文解释技术概念。",
      "messages": [
        {"role": "user", "content": "什么是工作区？"},
        {"role": "assistant", "content": "工作区用于组织 API 使用。"},
        {"role": "user", "content": "它和组织有什么区别？"}
      ]
    }

这是结构示意，省略了发起 API 请求所需的其他字段。示例中的 assistant 消息是应用在后续请求中提供的对话历史；应用可按 Messages API 约定组织历史内容，不必把它误认为当前请求中又生成的一条新答案。

| 位置或字段 | 在基础请求中的作用 | 阅读提示 |
| --- | --- | --- |
| **system** | 应用提供的指令，通常从对话开始时生效。 | 可说明任务方式、格式或约束。 |
| **messages** | 按顺序提供本次请求的对话消息。 | 消息是否包含先前轮次由应用决定。 |
| **role** | 标记一条消息属于哪类对话发言。 | 常见对话轮次是 user 与 assistant。 |
| **content** | 放置消息正文。 | 可以是字符串，也可以是有类型的内容块。 |

## 2. system 与 user 的职责不同

- **system 指令**通常由应用或服务操作者设置，描述模型应怎样完成任务，例如采用什么语气、输出格式或工作约束。
- **user 消息**包含终端用户当前提出的问题，也可以包含应用交给模型处理的输入资料。
- 官方文档说明 system 指令的优先级高于 user 消息。这个优先级描述的是提示中的指令层级，不等于应用已经获得了权限控制或安全保证。

因此，不要把用户提交的文本、检索到的网页或外部工具结果复制成 system 指令。应让这些内容保留为待处理的数据，并明确告诉 Claude 如何处理它们；应用仍要在模型之外执行真正的权限检查和副作用控制。

## 3. user、assistant 与 system 的位置

在基础 Messages API 对话中，user 表示用户侧输入，assistant 表示助手侧的对话轮次。通常应用从顶层 system 字段传入起始指令，再按顺序在 messages 中提供 user 与 assistant 消息。

Anthropic 当前还为特定模型和平台提供了在 messages 列表中插入中途 system 消息的能力，用来表达“从对话某处开始生效”的后续指令。它有模型支持及放置位置要求，不是所有模型都通用的第三种普通对话轮次。默认的起始指令仍放在顶层 system；只有确认当前模型支持且确实需要在中途改变指令时，才按官方规则使用该能力。[Mid-conversation system messages](https://platform.claude.com/docs/en/build-with-claude/mid-conversation-system-messages)

不要把 system 角色、API 的顶层 system 参数和 user/assistant 对话轮次混为一谈：基础用法里起始 system 指令位于消息列表之外；中途 system 是文档针对特定模型描述的扩展能力。

## 4. 上下文由应用按请求提供

基础 Messages API 调用是无状态的：若要让后续请求参考先前对话，应用需要在新请求中再次提供所需的历史消息和 system 指令。请求中的“上下文”因此是应用此次提交的指令与消息内容，不是自动等于 Claude.ai 界面里的完整聊天记录，也不会因为前一次调用而自动保存在普通 Messages 请求里。[Using the Messages API](https://platform.claude.com/docs/en/build-with-claude/working-with-messages)

历史应按任务需要整理和保留。可用的状态延续能力、消息历史管理和上下文窗口处理会在第19课讨论；本课只关注一次请求中各部分的位置与职责。

## 练习：判断应该放在哪里

一个客服应用想让 Claude 始终用简洁语气回答；用户本轮询问退货期限；数据库检索出一段退货政策；此前一轮中 Claude 已向用户确认订单日期。请判断这些内容分别适合放在哪里，并说明原因。

**参考答案：** 简洁语气属于应用级指令，放在顶层 system；用户的询问和需要分析的退货政策作为本次消息内容提供，不能把检索出的政策文本伪装成 system 指令；若确认订单日期仍对回答有用，应用可在 messages 中提供用户与 assistant 的相关历史。实际退款或修改订单的权限仍需应用逻辑检查。

## 本课结论

基础 Messages API 请求通过顶层 system 表达应用指令，通过有序 messages 提供对话历史；role 区分消息类型，content 承载文字或内容块。基础调用的上下文由应用在请求中提供。中途 system 消息是有模型和位置限制的特定能力；不要把它当作普遍规则，也不要用 system 字段代替应用权限控制。

## 范围与时效

- 官方文档核对日期：2026-11-10。
- 本课介绍基础 Messages 请求和当前文档中的中途 system 消息能力；实际支持以当前模型及官方文档为准。
- 多轮状态延续见第19课；工具调用闭环见第20课；应用安全与提示注入会在第27课展开。
