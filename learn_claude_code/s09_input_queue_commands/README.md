# 第 09 课：输入缓冲、消息队列与命令入口

**目标：** 追踪终端输入从编辑、提交到执行的路径，分清撤销历史、忙碌时的待处理队列，以及斜杠命令的识别与分派。

## 本课要回答的问题

1. `useInputBuffer` 保存的是什么，它和 REPL 的输入草稿、提交队列有什么不同？
2. 查询仍在运行时，普通提示、Bash 输入和可立即执行的命令分别怎样处理？
3. 队列由谁保存、何时开始消费，普通输入和斜杠命令怎样从队列分流？
4. `commands.ts` 的注册表、命令类型和实际分派入口各自负责什么？

## 三种不同的输入状态

| 状态 | 主要所有者 | 保存的内容 | 用途 |
| --- | --- | --- | --- |
| 当前草稿 | `PromptInput` / REPL | 正在编辑的文本、光标和粘贴内容 | 展示并继续编辑 |
| 编辑撤销缓冲 | `useInputBuffer` | 文本、光标、粘贴内容和时间戳的历史项 | 撤销最近的编辑 |
| 待处理命令 | `messageQueueManager` | 已提交的值、模式、粘贴数据、优先级等 | 等待 REPL 空闲后执行 |

`PromptInput` 创建的撤销缓冲最多保存 50 项，并用 1000 毫秒防抖合并快速编辑。常规文本改动前会把当前草稿推入缓冲；`chat:undo` 取回上一项并恢复文本、光标和粘贴内容。提交时，界面会清空这份编辑缓冲。它不是已提交命令的队列，也不是用于重新提交历史提示的会话历史。

## 从编辑到处理

下图追踪本地交互 REPL 的普通提交路径；remote bridge、Print 和 SDK 输入不在图中。

~~~mermaid
flowchart TD
  A[PromptInput 当前草稿] --> B[REPL.onSubmit]
  A -->|编辑前保存| U[useInputBuffer 撤销历史]
  B --> C{REPL 忙碌且命令可立即执行?}
  C -->|是: immediate local-jsx 或键绑定| D[本地即时命令路径]
  C -->|否| E[handlePromptSubmit]
  E --> F{查询活动或外部加载中?}
  F -->|否| G[executeUserInput]
  F -->|是且模式为 prompt 或 bash| H[enqueue 到统一队列]
  F -->|是且模式不支持| X[返回]
  G --> I[processUserInput]
  H --> J{REPL 空闲且无活动 local-jsx UI?}
  J -->|否| H
  J -->|是| K[processQueueIfReady]
  K --> L[executeQueuedInput]
  L --> M[handlePromptSubmit 接收 queuedCommands]
  M --> G
  I --> N{斜杠命令?}
  N -->|是| O[processSlashCommand]
  N -->|否| P[普通提示或 Bash 路径]
~~~

## 忙碌时的提交与统一队列

在本地普通交互路径中，`REPL.onSubmit()` 先处理少数可以绕过等待的本地 UI 命令。只有查询正在运行时，命令带有 `immediate: true`（或来自键绑定），并且命令类型是 `local-jsx`，才走这条即时路径。其余输入交给 `handlePromptSubmit()`。

`handlePromptSubmit()` 在查询活动或外部加载时，只接受 `prompt` 和 `bash` 模式进入队列。若有可中断的工具正在运行，会先中断当前轮，再把本次提交排队。队列项记录已经展开粘贴文本后的值，同时保留原始值、模式、必要的粘贴数据、`skipSlashCommands` 标记和 UUID；之后清空草稿、光标、粘贴数据与撤销缓冲。查询空闲时则直接构造一个 `QueuedCommand` 并调用 `executeUserInput()`，不必先写入全局队列。

`messageQueueManager.ts` 保存模块级的统一队列，用户输入、任务通知以及其他待处理消息共用它。`enqueue()` 默认优先级为 `next`，任务通知默认 `later`；优先级顺序为 `now`、`next`、`later`，同级按先进先出。`useCommandQueue()` 通过 `useSyncExternalStore` 订阅只读快照，供 React 界面读取；`useQueueProcessor()` 也订阅队列和 `QueryGuard`，但负责触发消费。

消费条件是没有活动查询、没有阻塞输入的本地 JSX UI，并且队列非空。处理器从主线程队列取项：斜杠命令和 Bash 输入一次处理一项；普通非斜杠输入会按相同 `mode` 一批交给 `executeInput()`。`executeQueuedInput()` 将该批 `queuedCommands` 交回 `handlePromptSubmit()`；这个入口直接执行这些命令，不会把它们重新排队。

## 命令注册与斜杠分派

`src/commands.ts` 汇总内置命令，并包含按功能开关加载的命令；命令结构定义在 `src/types/command.ts`。共同字段包括 `name`、`aliases`、启用条件和可选的 `immediate` 标记。联合类型区分三种行为：`prompt` 提供要并入对话的提示内容，`local` 执行本地逻辑，`local-jsx` 可返回终端交互界面。

交互提交时，`REPL.onSubmit()` 从输入首个 `/` 后解析命令名与参数，并在当前启用的命令中按 `name`、别名或 `getCommandName()` 查找匹配项。`commands.ts` 的 `findCommand()` / `getCommand()` 也提供相同字段的通用查找能力，但 REPL 提交路径会自行筛选启用命令。进入普通输入处理后，`processUserInput()` 再调用 `processSlashCommand()` 执行斜杠命令分支。因此要区分三层：注册表提供可用命令，REPL 识别并选择入口，输入处理模块执行对应类型的命令。

## 静态观察

在仓库根目录执行以下命令，只读取源码：

~~~sh
nl -ba AI/claude-code-analysis-main/src/hooks/useInputBuffer.ts | sed -n '1,132p'
nl -ba AI/claude-code-analysis-main/src/components/PromptInput/PromptInput.tsx | sed -n '832,901p;1300,1310p'
nl -ba AI/claude-code-analysis-main/src/screens/REPL.tsx | sed -n '3142,3280p;3312,3355p;3859,3893p'
nl -ba AI/claude-code-analysis-main/src/utils/handlePromptSubmit.ts | sed -n '227,350p;353,387p;448,496p'
nl -ba AI/claude-code-analysis-main/src/utils/messageQueueManager.ts | sed -n '41,80p;123,193p;241,267p'
nl -ba AI/claude-code-analysis-main/src/hooks/useCommandQueue.ts
nl -ba AI/claude-code-analysis-main/src/hooks/useQueueProcessor.ts | sed -n '16,67p'
nl -ba AI/claude-code-analysis-main/src/utils/queueProcessor.ts | sed -n '17,87p'
nl -ba AI/claude-code-analysis-main/src/types/command.ts | sed -n '25,55p;144,215p'
nl -ba AI/claude-code-analysis-main/src/commands.ts | sed -n '1,45p;688,719p'
nl -ba AI/claude-code-analysis-main/src/utils/processUserInput/processUserInput.ts | sed -n '470,490p'
nl -ba AI/claude-code-analysis-main/src/utils/processUserInput/processSlashCommand.tsx | sed -n '309,360p'
~~~

## 观察结果

编辑撤销缓冲记录“尚在输入框里”的历史状态；统一队列记录“已经提交但暂时不能处理”的命令。REPL 在提交时先检查可立即运行的本地 UI 命令，再将其余输入交给 `handlePromptSubmit()`。忙碌时允许的普通提示和 Bash 内容进入共享队列；查询空闲后由订阅队列变化的处理器取出，再进入 `processUserInput()`。斜杠输入会在命令入口处分派，队列处理还会将其与 Bash 一样单独处理。

## 简化与限制

- 本课覆盖交互 REPL 的普通提交和队列主路径，不展开 remote bridge、Print/SDK、自主 Agent 队列等独立入口。
- “立即命令”仅按本源码中的 `local-jsx` 即时分支说明；其他命令类型仍可能走普通提交、队列或输入处理路径。
- 结论来自当前源码静态阅读；没有运行 CLI，也没有验证终端交互或模型请求。
