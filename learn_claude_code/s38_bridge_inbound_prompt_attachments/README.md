# 第 38 课：Bridge 远端消息入队与附件处理

**目标：** 从已分流的远端 user 消息追到 REPL 输入队列，理解内容归一化、附件落盘、UUID 保留与远程 slash-command 安全门。

## 本课要回答的问题

1. 哪些 SDK 消息可以成为本地 prompt，UUID 如何保留？
2. Bridge 客户端的图片块缺少 `media_type` 时怎样兼容？
3. `file_attachments` 怎样从远端下载成当前 session 可读取的本地文件？
4. 文件路径怎样插入字符串或多模态内容，为什么选择最后一个 text block？
5. `bridgeOrigin` 和 `skipSlashCommands` 怎样共同约束远端 slash command？

## 从 user SDK message 到本地队列

第36课追到 `handleIngressMessage()` 把 user 消息交给 `onInboundMessage`；本课跟进 `useReplBridge.tsx` 中的 handler。它先抽取内容和 UUID、修正必要的图片块，再解析附件，最后把 prompt 放入 REPL 的消息队列。

~~~mermaid
flowchart TD
  A[Bridge 收到已分流的 user SDKMessage] --> B[extractInboundMessageFields]
  B --> C{user 且 content 非空?}
  C -->|否| D[跳过，不入队]
  C -->|是| E[提取 UUID；归一化异常图片块]
  E --> F{附件数组有效且非空?}
  F -->|否| G[沿用原 content]
  F -->|是| H[OAuth 下载附件并写入 session uploads 目录]
  H --> I[成功的路径变为 @"path" 前缀]
  I --> J[插到最后一个 text block，或补一个 text block]
  G --> K[enqueue prompt，保留 UUID]
  J --> K
  K --> L[bridgeOrigin slash-command 判断]
  L -->|安全命令| M[允许命令分支]
  L -->|已知不安全命令| N[返回 Remote Control 不支持提示]
  L -->|未知 /foo| O[作为普通文本继续]
  H -. 单个附件失败 .-> P[忽略该附件，prompt 仍可入队]
~~~

### 消息和图片块归一化

`extractInboundMessageFields()` 只接受 `type === 'user'`，并跳过没有内容或空数组。它保留消息原 UUID；如果内容是 block 数组，就调用 `normalizeImageBlocks()`。当 base64 image block 缺少 snake_case `media_type` 时，代码先尝试读取客户端传来的 camelCase `mediaType`，否则从 base64 内容推断格式，再构造规范字段。若没有需要修正的 block，则直接返回原数组引用。

保留 UUID 的目的不只是方便日志：该 prompt 后续会进入本地消息流并可能同步回 CCR；保持远端 UUID 可让回写与服务端原消息对应，避免生成一个看起来不同的新事件。

若 `KAIROS_GITHUB_WEBHOOKS` 功能开启，handler 还会在附件处理前调用 `sanitizeInboundWebhookContent()`；否则沿用抽取出的原始 content。它是特定 webhook 路径的预处理，不是所有 Bridge 消息的通用过滤器。

### 附件下载与路径注入

`extractInboundAttachments()` 对消息上的 `file_attachments` 做 Zod 结构检查，要求它是由 `file_uuid` 和 `file_name` 组成的数组。结构不合法时返回空数组。每个有效附件并发请求 OAuth 文件内容 endpoint；没有 access token、HTTP 状态不是 200、网络错误或磁盘写入失败时，该附件返回 undefined，不阻止其他附件继续处理。

成功的文件写到 `getClaudeConfigHomeDir()/uploads/<sessionId>/`。网络提供的 `file_name` 不可信：写盘前先取 basename，再把字符限制在英文字母、数字、点、下划线和连字符；文件名还会加上 `file_uuid` 前缀。返回的路径以带引号的 `@"..."` 形式加入 prompt，让路径中的空格不会被当成多个引用。这个流程把文件落在本机，随后由模型工具读取；附件内容并没有作为一大段 base64 直接拼进 prompt。

`prependPathRefs()` 同时支持字符串和多模态 block 数组。字符串前直接加路径；数组则把路径前缀放到最后一个 text block 的开头。若数组没有 text block，就在末尾追加一个。这样做对应 `processUserInputBase` 对最后一个 text block 取 `inputString` 的约定；放在前面的 text block 可能不能成为文件引用输入。

### 远端命令门

handler 入队时保留原 UUID，并设置 `mode: 'prompt'`、`skipSlashCommands: true`、`bridgeOrigin: true`。这让队列的通用 slash-command 快路径继续关闭，同时把来源信息交给 `processUserInputBase` 做有条件的例外判断：

| 远端输入 | 处理方式 |
| --- | --- |
| 已知且 Bridge-safe 的 slash command | 清除本轮的有效 skip 标记，允许命令路径 |
| 已知但不安全的命令 | 直接返回 “Remote Control 不支持” 的本地结果，不送模型 |
| 未知或无法解析的 `/foo` | 作为普通 prompt 文本继续，不报本地 “Unknown skill” |

`isBridgeSafeCommand()` 把 prompt 类型命令视为可安全展开；local 命令需要显式 allowlist；local-jsx 命令会渲染本地 Ink UI，因此不允许远程调用。这是命令入口的范围限制，不代表远端消息本身都经过了内容可信验证。

## 异步时序与失败边界

`handleInboundMessage()` 是 async，但第36课的 ingress helper 对 callback 使用 fire-and-forget。没有附件时通常很快入队；有附件时需要等待网络和落盘，入队会稍晚。源码注释认为 web prompt 不会快速连续到达，因此接受这段延迟；静态代码没有提供附件消息相对于后续 prompt 的严格入队顺序保证。

附件下载和写盘的单项失败会被降级为“没有该路径引用”，其余文本和图片仍可入队。handler 周围的 catch 则记录意外错误；如果异常发生在附件函数未自行吞掉的步骤，当前消息会在 enqueue 前结束处理。

## 与相邻课程的边界

- 第11课讨论本地消息、附件与终端展示；本课只跟 Bridge 从服务端接收附件引用并把它们变成本地路径的过程。
- 第36课讲 Bridge 入站识别、UUID 去重和 callback 分流；本课从 user callback 开始，跟到 REPL 队列。
- 第37课讲服务端控制请求；本课只处理普通 user 消息，不展开控制消息。

## 静态观察

以下命令只读取当前源码快照：

~~~sh
nl -ba engine/claude-code-analysis-main/src/bridge/inboundMessages.ts | sed -n '21,80p'
nl -ba engine/claude-code-analysis-main/src/bridge/inboundAttachments.ts | sed -n '31,175p'
nl -ba engine/claude-code-analysis-main/src/hooks/useReplBridge.tsx | sed -n '172,221p'
nl -ba engine/claude-code-analysis-main/src/utils/processUserInput/processUserInput.ts | sed -n '122,132p;422,453p'
nl -ba engine/claude-code-analysis-main/src/commands.ts | sed -n '664,676p'
nl -ba engine/claude-code-analysis-main/src/utils/messageQueueManager.ts | sed -n '534,547p'
~~~

## 观察结果

- Bridge callback 只把非空 user 内容变成 prompt，并保留源消息 UUID；图片块在进入 Query 前会补齐缺失的 media type。
- 文件附件经过结构校验、OAuth 下载、文件名清洗和 session-scoped 落盘，再以引用前缀加入输入。
- 路径被放在最后一个 text block，是为了符合输入处理器提取文件引用文本的约定。
- 远端来源标记让 slash command 经过 allowlist 判断；安全命令、已知不安全命令和未知命令走不同结果。

## 范围与限制

- 结论来自仓库当前 Claude Code 源码快照的静态阅读；没有连接文件服务、下载真实附件或在 REPL 中运行远端命令。
- 文件下载按 best-effort 处理，但本课不验证本机目录权限、文件生命周期清理或 CCR 端的上传/下载合同。
