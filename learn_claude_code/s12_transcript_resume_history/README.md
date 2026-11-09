# 第 12 课：Transcript、会话恢复与历史

**目标：** 从当前消息状态追踪到本地 JSONL transcript，再从磁盘记录还原会话；区分本地恢复列表与 Assistant viewer 使用的远端事件历史。

## 本课要回答的问题

1. 当前 user/assistant 消息怎样成为带父子关系的 transcript 记录？
2. JSONL 读取时怎样还原有效会话链，而不是简单按文件顺序展示所有记录？
3. `/resume` 与 CLI 的 `--continue` / `--resume` 怎样找到并恢复旧会话？
4. `assistant/sessionHistory.ts` 的远端分页历史和本地 transcript 有何不同？

## 先区分三种“历史”

| 数据 | 存放位置或来源 | 主要用途 |
| --- | --- | --- |
| 本地 transcript | 配置目录的 `projects/<project>/<sessionId>.jsonl` | 记录消息、父 UUID、会话元数据和恢复所需的附属记录 |
| 本地恢复列表 | 从 JSONL 文件信息整理出的 `LogOption[]` | 给 `/resume` 选择会话，并支持按 ID 或标题定位 |
| Assistant viewer 远端历史 | Sessions API 的 `/v1/sessions/<id>/events` | viewer 模式按页读取服务端事件，向上滚动时加载更早内容 |

这三者的读取路径不同。尤其是 `assistant/sessionHistory.ts` 的分页请求不会扫描本地项目目录，也不是 `/resume` 读取 JSONL 的实现。

## 本地消息如何写进 transcript

交互 REPL 的 `useLogMessages()` 在消息数组变化后调用 `recordTranscript()`；它通常只交给持久化器新增尾部，初次记录或压缩后则交整段消息供 UUID 去重。QueryEngine 也会在请求流程的若干边界调用同一持久化函数。

`recordTranscript()` 先用 `cleanMessagesForLogging()` 清理记录，再按 UUID 和已有会话记录去重，并计算起始父 UUID。随后 `Project.insertMessageChain()` 为每条 transcript 消息写入 `parentUuid`、`sessionId`、`cwd`、版本等字段。普通链条按上条消息接续；工具结果若带有 `sourceToolAssistantUUID`，会连接到对应的 assistant 工具调用。压缩边界会切断物理父链，同时保留逻辑父 UUID。

`getTranscriptPath()` 根据当前 session project directory 或原始工作目录生成项目目录下的 session JSONL 路径。当前文件尚未物化时，启动元数据会先缓存；出现首条 user/assistant 消息后才创建文件并写入缓存。写入队列将每个 Entry 序列化成一行 JSON 后追加到文件。持久化设置、测试模式和启动参数可以关闭写入，所以“消息在 UI 中出现”不必然意味着已有本地 transcript。

`TranscriptMessage` 是带 `parentUuid`、`sessionId`、`cwd` 等字段的对话记录；`Entry` 还包含 summary、custom title、tag、worktree state、文件历史快照等非对话记录。当前 transcript message 类型包括 user、assistant、attachment、system；progress 属于临时 UI 状态，不参加新的 transcript 父链。读取器仍需兼容旧 JSONL 中曾写入过的 progress 记录。

## 从 JSONL 还原会话链

`loadTranscriptFile()` 将 JSONL 解析成 UUID 到消息的映射，并分别收集摘要、标题、标签、模式、worktree 等元数据。它会兼容旧 progress 记录：记录 progress 到父 UUID 的桥接关系，再把后续消息的 parent 指针接回有效消息。读完后计算可用的 user/assistant 叶节点；system 和 attachment 可以保存在 transcript 中，但不会单独作为恢复锚点。

`buildConversationChain()` 从选定叶节点沿 `parentUuid` 向前走到根，再反转为对话顺序。它会检测环并对并行工具调用结果做补充恢复，因此 JSONL 虽按行追加，逻辑结构仍是带分支的父子图。

`loadFullLog()` 用 `loadTranscriptFile()` 读出完整消息并构造 `LogOption`。为了快速展示恢复列表，代码也会先创建仅含文件路径、修改时间、session ID 等信息的 lite log，再读取少量文件内容补上首条提示、标题等展示字段；用户选择某条 lite log 后才加载完整记录。

## 选择会话并恢复状态

`/resume` 不带参数时打开选择器。选择器默认加载当前仓库及其 worktree 的会话，也可切换到所有项目；它过滤当前会话和 sidechain。选中条目后，如记录仍是 lite log，就调用 `loadFullLog()`，然后把完整 `LogOption` 交给 REPL 的 resume 回调。带参数时，命令还可以按 session UUID 或启用时的精确自定义标题定位。

CLI 的 `--continue` / `--resume` 共用 `loadConversationForResume()` 的恢复准备逻辑，但来源不同：不传 source 时选择最近的可继续会话；传入 session ID 时读对应日志；传 JSONL 路径时从该文件还原。加载后会恢复相关 metadata，反序列化消息并处理未完成工具调用，再把会话启动 Hook 消息附加到恢复列表。CLI 的 `processResumedConversation()` 负责后续模式、session ID、transcript 路径和会话状态恢复。

交互 `/resume` 的 REPL 回调也会反序列化消息，并恢复文件历史、Agent 信息、读取文件状态、费用和工作目录等状态。常规 resume 会切换到目标 session ID，重设 session file pointer 并接管原 transcript；最后把恢复后的消息写回 `messages` 状态、清空输入和活动工具 UI。fork 则保留新的 session ID，并在新 session 中建立自己的 transcript。

~~~mermaid
flowchart TD
  A[REPL 消息数组] --> B[useLogMessages]
  B --> C[recordTranscript 清理并去重]
  C --> D[insertMessageChain 补 parentUuid]
  D --> E[Entry JSONL 行追加]
  E --> F[loadTranscriptFile 解析消息与元数据]
  F --> G[叶节点与 buildConversationChain]
  G --> H[LogOption]
  H --> I[/resume 选择器]
  H --> J[CLI continue 或 resume]
  I --> K[REPL.resume 恢复状态并 setMessages]
  J --> L[loadConversationForResume]
  L --> M[processResumedConversation]
  M --> N[CLI REPL 初始会话]
  O[Assistant viewer] --> P[fetchLatestEvents / fetchOlderEvents]
  P --> Q[SDK events 转成界面消息]
~~~

## 远端 Assistant viewer 的分页历史

`assistant/sessionHistory.ts` 创建带认证信息的 Sessions API 上下文。最新页通过 `anchor_to_latest` 获取，向前翻页通过 `before_id` 游标获取，每页默认 100 个 SDK events。`useAssistantHistory()` 只在 KAIROS viewer-only 路径启用：挂载时拉最新页，用户滚到列表上方时继续加载旧页，并通过 `convertSDKMessage()` 把 SDK events 转为界面消息。

这条远端历史适合只读 viewer 展示；它不提供本地 `/resume` 选择器的 JSONL 恢复能力。

## 静态观察

在仓库根目录执行以下命令，只读取源码：

~~~sh
nl -ba engine/claude-code-analysis-main/src/hooks/useLogMessages.ts | sed -n '19,26p;34,75p;91,118p'
nl -ba engine/claude-code-analysis-main/src/QueryEngine.ts | sed -n '440,460p'
nl -ba engine/claude-code-analysis-main/src/types/logs.ts | sed -n '8,17p;19,53p;221,231p;297,318p'
nl -ba engine/claude-code-analysis-main/src/utils/sessionStorage.ts | sed -n '139,156p;198,229p;606,675p;841,860p;993,1083p;1128,1155p;1408,1449p;2572,2584p'
nl -ba engine/claude-code-analysis-main/src/utils/sessionStorage.ts | sed -n '2069,2094p;2294,2355p;2940,3010p;3472,3498p;3614,3658p;3704,3728p'
nl -ba engine/claude-code-analysis-main/src/utils/sessionStorage.ts | sed -n '4073,4108p;4975,5069p'
nl -ba engine/claude-code-analysis-main/src/commands/resume/resume.tsx | sed -n '107,191p;194,270p'
nl -ba engine/claude-code-analysis-main/src/utils/conversationRecovery.ts | sed -n '487,590p'
nl -ba engine/claude-code-analysis-main/src/utils/sessionRestore.ts | sed -n '95,115p;409,493p'
nl -ba engine/claude-code-analysis-main/src/screens/REPL.tsx | sed -n '1735,1742p;1799,1832p;1843,1865p;1877,1885p;1927,1939p;1277,1299p'
nl -ba engine/claude-code-analysis-main/src/assistant/sessionHistory.ts | sed -n '30,87p'
nl -ba engine/claude-code-analysis-main/src/hooks/useAssistantHistory.ts | sed -n '47,63p;143,190p'
nl -ba engine/claude-code-analysis-main/src/remote/sdkMessageAdapter.ts | sed -n '1,80p'
~~~

## 观察结果

本地恢复围绕 JSONL Entry、UUID 和 `parentUuid` 链工作：消息先被写入项目 session 文件，读取器再选择 user/assistant 叶节点并重建对应对话链；恢复流程在会话消息之外还补回 Agent、worktree、文件历史等状态。Assistant viewer 则从服务端事件端点按页取数。它们虽然都显示“历史消息”，但存储、定位方式和用途并不相同。

## 简化与限制

- 本课聚焦交互 transcript、常规 `/resume` 和 CLI 的 `--continue` / `--resume`；不展开 Print 导出、完整 fork、远程 session ingress 或 transcript 文件格式的全部兼容分支。
- 项目目录、持久化开关、worktree、压缩边界和功能开关会影响文件位置、恢复候选和恢复状态。
- Assistant viewer 的远端分页只在对应 viewer 配置与构建路径下启用。
- 结论来自当前源码快照的静态阅读；没有启动 CLI、读取真实 session 文件或请求远端 Sessions API。
