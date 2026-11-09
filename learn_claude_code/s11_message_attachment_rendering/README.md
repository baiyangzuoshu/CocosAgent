# 第 11 课：消息、附件与终端展示

**目标：** 从会话中的消息对象追到终端列表，理解消息如何被拆分、过滤和分组，再由对应组件展示；同时区分 UI 归一化与 API 请求归一化。

## 本课要回答的问题

1. `createUserMessage()`、`createAssistantMessage()`、`createSystemMessage()` 分别构造什么记录？
2. 附件消息与 user/assistant 消息是什么关系？附件是否会进入模型请求？
3. `Messages` 怎样把会话记录变成可渲染的行？
4. `Message` 如何按消息类型与内容块类型选择终端组件？

## 先区分记录、内容块和附件

会话数组里的顶层 `type` 描述记录类别；user/assistant 消息内部还有 `message.content` 内容块。附件则是另一种顶层记录，具体数据放在 `attachment` 对象中。

| 记录 | 构造入口 | 结构与用途 |
| --- | --- | --- |
| assistant | `createAssistantMessage()` | 字符串会转成一个 `text` 内容块，再交给 `baseCreateAssistantMessage()`；模型返回的内容块数组则保留为块 |
| user | `createUserMessage()` | 顶层 `type: 'user'`，内部 `message.role: 'user'`；还带 UUID、时间戳以及可选的来源、图片粘贴 ID、工具结果等元数据 |
| system | `createSystemMessage()` | 独立的 system 记录，含 subtype、文本、级别、UUID 和时间戳 |
| attachment | `createAttachmentMessage()` | 顶层 `type: 'attachment'`，含独立的 attachment payload、UUID 和时间戳 |

`Attachment` 是按 `attachment.type` 区分的联合类型，覆盖文件/目录引用、IDE 选区、记忆、排队输入、Hook 状态等会话事件。`getAttachmentMessages()` 会从当前输入、IDE 选区等上下文收集附件，再逐项包装成 attachment 记录。它们与模型的 user/assistant 对话记录分层存放。

附件记录也不等于“永远不发给模型”。`normalizeMessagesForAPI()` 会先调整附件顺序并剔除虚拟 user/assistant 记录，再调用 `normalizeAttachmentForAPI()`；后者可把部分附件转为 meta user 消息，也可对不需要发送的类型返回空数组。API 路径随后把结果合并到相邻 user 消息或加入请求消息列表。因此要分别阅读 UI 的 `normalizeMessages()` 和请求侧的 `normalizeMessagesForAPI()`。

## UI 展示链

`Messages` 组件先用 `normalizeMessages()` 准备展示形态：assistant 的多个内容块拆成独立行；user 字符串转为 text 块，内容块数组也逐块拆开；附件、progress、system 记录在这一步保留。拆分时会按需要派生 UUID，避免同一原始消息的多行拥有相同 key。

随后 `Messages` 进行可见性筛选、排序和压缩：progress 记录不作为普通行展示；会渲染为空的附件会在计数和 200 行上限之前滤掉；用户消息可能受 transcript/REPL 模式影响。接着处理工具分组、可折叠读文件组和其他摘要，得到 `renderableMessages`。虚拟列表和普通列表共用 `renderMessageRow()`。

~~~mermaid
flowchart TD
  A[会话 Message 数组] --> B[Messages: normalizeMessages]
  B --> C[筛选、排序、分组、折叠]
  C --> D[renderableMessages]
  D --> E[renderMessageRow]
  E --> F[MessageRow]
  F --> G{Message 按顶层 type 分派}
  G -->|attachment| H[AttachmentMessage 按 attachment.type]
  G -->|assistant| I[AssistantMessageBlock 按 content.type]
  G -->|user| J[UserMessage 按 content.type]
  G -->|system| K[边界组件或 SystemTextMessage]
  I --> L[AssistantText / ToolUse / Thinking 等]
  J --> M[UserText / Image / ToolResult 等]
~~~

## 组件如何选择展示形式

`MessageRow` 负责行级上下文，并把当前消息传给 `Message`。`Message` 按顶层 `message.type` 分支：

- `attachment` 交给 `AttachmentMessage`，它再按 `attachment.type` 选择呈现方式。例如文件和目录显示简短操作摘要，IDE 选区显示路径与行数，排队命令可显示输入文本和图片。
- `assistant` 的内容块逐块交给 `AssistantMessageBlock`；`text`、`tool_use`、`thinking` 等块进入不同组件。thinking 等块还会按 verbose/transcript 模式隐藏或显示。
- `user` 的文本、图片和工具结果按块分派；文本再经过 `UserTextMessage`。system 记录可显示系统文本，也可能是折叠边界等专用行，部分边界记录在界面中不显示。

有些附件即使保留在会话数组中，也不需要独立占据可见行。`nullRenderingAttachments.ts` 集中列出始终返回 null 的类型；`Messages` 在计算消息数量和截断前先过滤它们，`AttachmentMessage` 的默认分支再提供一层防护。这样隐藏的 Hook 通知等记录不会消耗可见消息上限。

## 静态观察

在仓库根目录执行以下命令，只读取源码：

~~~sh
nl -ba engine/claude-code-analysis-main/src/utils/messages.ts | sed -n '411,433p;460,523p;731,823p;1989,2001p;2269,2290p;3453,3472p;4335,4352p'
nl -ba engine/claude-code-analysis-main/src/utils/attachments.ts | sed -n '440,510p;2937,2970p;3201,3210p'
nl -ba engine/claude-code-analysis-main/src/components/Messages.tsx | sed -n '375,380p;496,520p;614,625p;699,701p'
nl -ba engine/claude-code-analysis-main/src/components/MessageRow.tsx | sed -n '228,246p'
nl -ba engine/claude-code-analysis-main/src/components/Message.tsx | sed -n '82,98p;98,156p;157,230p;231,310p;433,433p;483,523p;539,558p'
nl -ba engine/claude-code-analysis-main/src/components/messages/AttachmentMessage.tsx | sed -n '126,166p;232,242p;312,354p'
nl -ba engine/claude-code-analysis-main/src/components/messages/nullRenderingAttachments.ts | sed -n '14,70p'
~~~

## 观察结果

可以沿两条不同的 `normalize` 路径核对数据流：UI 路径把会话记录转成终端行，并按模式隐藏、合并或折叠内容；API 路径则把附件转换为请求可用的 user 消息，或将其省略。最终的可见行由 `Message` 的顶层记录类型和内部内容块类型共同决定。

## 简化与限制

- 本课聚焦消息进入 `Messages` 后的展示流程，以及附件送入 API 前的转换边界；不展开工具结果如何产生，也不复述 Ink 的帧布局过程。
- verbose/transcript 模式、终端宽度、功能开关和附件类型都会改变可见内容。
- 结论基于当前源码快照的静态阅读；没有运行 CLI，也没有把特定会话中的最终终端输出作为运行时证据。
