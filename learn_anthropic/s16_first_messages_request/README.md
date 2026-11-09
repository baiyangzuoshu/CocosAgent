# 第 16 课：如何发出第一个 Messages API 请求？

**目标：** 能按官方 Quickstart 准备账户、认证和 SDK，发出一个最小 Messages 请求，并读出返回的文字内容。

## 本课问题

从“我有 API Key”到第一次看到 Claude 的 API 响应，中间要准备什么？请求里哪些字段是必需的？SDK 替我们处理了哪些 HTTP 细节？

## 官方资料

- [Get started with Claude](https://platform.claude.com/docs/en/get-started)：当前 Quickstart、依赖安装和第一个 API 调用示例。
- [Messages API：Create a Message](https://platform.claude.com/docs/en/api/messages/create)：Messages 请求字段与响应对象的 API Reference。
- [API overview](https://platform.claude.com/docs/en/api/overview)：API 前置条件、认证头与 SDK 责任。
- [API versions](https://platform.claude.com/docs/en/api/versioning)：直接发 HTTP 请求时如何指定 API 版本。
- [Authentication](https://platform.claude.com/docs/en/manage-claude/authentication)：API Key、工作区范围与认证方式；密钥保存规则见第15课。
- [Models overview](https://platform.claude.com/docs/en/models/overview)：核对当前可用的模型 ID 与适用条件。

核对日期：2026-11-10。模型 ID 和 API 版本会更新；下例采用当天 Quickstart 展示的模型名称，动手前请在模型目录复核自己的账户可用项。

## 1. 第一次请求前要准备什么？

1. **Claude Console 账户和 API 凭据：** 可使用 API Key，或按第15课设置 Workload Identity Federation。Claude 产品订阅和 API 使用入口不同，需确认自己的账户已开通 API 用量。
2. **安全提供凭据：** Quickstart 的 SDK 会从 ANTHROPIC_API_KEY 环境变量读取 API Key。不要把真实值写进源码或客户端构建包。
3. **开发环境和 SDK：** 本课用 Python 示例；安装当前 Anthropic Python SDK。其他语言的依赖按同一 Quickstart 选择。
4. **可用的模型 ID 和工作区：** 选择当前文档及账户支持的模型。若 API Key 未限制到某个工作区，请按第15课传入工作区 ID。

官方 Quickstart 说明直接使用 Claude API 的前置条件是 Claude Console 账户和 API Key；SDK 方式会自动处理认证头、API 版本头和 Content-Type。[Get started](https://platform.claude.com/docs/en/get-started) · [API overview](https://platform.claude.com/docs/en/api/overview)

## 2. 安装 SDK 并准备环境变量

按照当前 Python Quickstart 安装 SDK：

    python -m pip install anthropic

将 API Key 放入本地安全存储或密钥管理服务，再注入运行环境。SDK 默认读取 ANTHROPIC_API_KEY。变量名是接口约定，不代表把真实 Key 写在 Python 文件里就安全；密钥存放和轮换方式回看第15课。

## 3. 最小 Messages 请求

以下示例沿用官方 Quickstart 的结构。模型 ID 是 2026-11-10 页面快照；如账户无法使用，请先从 Models overview 选择一个当前可用的 ID。

    import anthropic

    client = anthropic.Anthropic()

    message = client.messages.create(
        model="claude-opus-5-5",
        max_tokens=1000,
        messages=[
            {
                "role": "user",
                "content": "用一句话解释什么是 API。",
            }
        ],
    )

    for block in message.content:
        if block.type == "text":
            print(block.text)

在 shell 环境中运行前，先由安全的本地方式设置 ANTHROPIC_API_KEY；不要将真实 Key 粘贴到课程、源码或命令历史中。

## 4. 逐项读懂请求

| 字段或步骤 | 作用 | 本例 |
| --- | --- | --- |
| **client** | 建立 SDK 客户端；从环境读取认证信息，并管理请求头和 HTTP 交互。 | 使用默认 Anthropic 客户端。 |
| **model** | 指定本次请求要调用的模型。 | 使用 Quickstart 当日示例；动手时按当前目录复核。 |
| **max_tokens** | 限制本次生成的最大输出 token 数。它是上限，不保证 Claude 一定用满。 | 限制输出规模。 |
| **messages** | 提供本次对话输入；每条至少包含角色和内容。 | 一条 user 消息即可完成单轮提问。 |
| **content** | 消息正文；最简单时可直接使用字符串。 | 普通文本问题。 |

这个请求调用 Messages API 的创建消息操作，HTTP 路径为 POST /v1/messages。一次调用可只包含一条 user 消息；多轮时，应用会在请求中提供相关的对话消息。状态延续方式留到第19课。[Create a Message](https://platform.claude.com/docs/en/api/messages/create)

## 5. SDK 帮忙做了什么？

用 SDK 创建客户端时，SDK 会读取认证凭据，按当前文档设置 HTTP 认证、API 版本和内容类型，并把响应解析为可访问的对象。若 Key 已限制到一个工作区，通常不必额外传工作区头；未限定工作区的 Key 需要指定目标工作区，且代表 Key 的用户或服务账号必须有权限。细节回看第15课。[Authentication](https://platform.claude.com/docs/en/manage-claude/authentication)

直接写 HTTP 请求时，不能照抄 SDK 代码。除了发送 POST 请求和 JSON body，还要提供当前 API 文档要求的认证头、API 版本头与 Content-Type。版本会演进，使用 API Reference 中当前的版本说明；不要把旧教程里的固定版本值当永久常量。[API versions](https://platform.claude.com/docs/en/api/versioning)

## 6. 怎样确认第一次调用成功？

成功时，SDK 返回一个 Message 对象，其中 content 是内容块数组。最小文本请求通常会有 text 类型的内容块；示例遍历数组，只打印 text block，而不假设所有响应的第一块永远都是文字。

如果没有得到预期响应，按这个顺序检查：

1. SDK 是否已安装到当前 Python 环境，运行程序的环境能否读取 ANTHROPIC_API_KEY。
2. API Key 是否有效，Console 账户是否有 API 用量权限。
3. 使用的模型 ID 是否拼写正确，并且当前账户可以调用。
4. 未绑定单一工作区的 Key 是否附带了正确的工作区 ID；该身份是否有权限访问它。
5. 查看 API 返回的错误类型和 request ID，再按官方错误说明排查；错误码与重试策略留到第24课。

## 7. 用原始 HTTP 看请求的形状

客户端 SDK 自动提供的内容，可在概念上对应到下面这些 HTTP 部分：

    Method: POST
    Path: /v1/messages
    Headers:
      Authorization: Bearer [安全存储提供的凭据]
      anthropic-version: [当前文档要求的 API 版本]
      content-type: application/json
      anthropic-workspace-id: [仅未绑定工作区的凭据需要]

    JSON body:
      model: [当前可用模型 ID]
      max_tokens: [输出上限]
      messages:
        - role: user
          content: [用户输入]

这是结构示意，不是可直接复制执行的请求。使用官方 SDK 可减少手动维护认证头和 API 版本的机会；原始 HTTP 使用者应按当前 API overview 和 versioning 文档补齐必需内容。

## 练习：定位第一次调用的前置条件

某开发者安装了 SDK，也在 Console 创建了 API Key，但运行时提示找不到凭据。程序里指定了 Claude Opus 5.5，调用成功后却没有打印文本。

请列出至少三项应检查的配置或代码位置。

**参考答案：** 检查密钥是否安全地注入当前运行环境，以及环境变量名是否为 ANTHROPIC_API_KEY；核对模型 ID 在当前 Models overview 中是否可用；检查工作区范围，未绑定单一工作区的 Key 是否需要工作区请求头；还要确认代码遍历 message.content 并打印 text block，而不是把整个响应对象当作纯字符串。不要将真实密钥粘贴给他人排错。

## 本课结论

第一个 Messages API 请求需要可用的 Console/API 账户、受保护的认证凭据、可用的模型 ID 和最小请求字段。SDK 让认证头、版本头和响应解析更省事；应用仍需检查工作区权限、模型可用性和返回的内容块。

## 范围与时效

- 官方 Quickstart、API Reference 和 Models overview 核对日期：2026-11-10。
- 示例使用 Python SDK 和当天 Quickstart 展示的模型 ID；版本和模型会更新，不代表账户一定拥有该模型的访问权限。
- 本课只读懂最小单轮请求，不实际配置凭据或发送 API 请求；多轮、响应字段和错误处理留给后续课程。
