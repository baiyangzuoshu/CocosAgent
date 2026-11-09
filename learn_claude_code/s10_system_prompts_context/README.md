# 第 10 课：系统提示词与用户上下文

**目标：** 找出默认提示、用户配置、项目指令、Git 状态和会话消息分别从哪里产生，以及它们在哪一层汇合到模型请求。

## 本课要回答的问题

1. 默认 system prompt 如何生成，REPL 又如何决定使用默认、自定义、Agent 或覆盖提示？
2. `getUserContext()` 和 `getSystemContext()` 分别收集什么，它们进入请求的方式有何不同？
3. 当前 transcript 和本轮新消息怎样与这两类 context 一起传给模型？
4. system prompt 的静态/动态边界对缓存分段有什么作用？

## 先分清请求里的四层数据

| 层 | 例子 | 最终进入模型请求的位置 |
| --- | --- | --- |
| 有效 system prompt | Claude Code 默认指令、Agent 指令、`--system-prompt`、`--append-system-prompt` | `system` 参数 |
| `userContext` | `CLAUDE.md` 指令、当前日期、部分 coordinator/terminal 状态 | 加在会话消息之前的 `isMeta` user 消息 |
| `systemContext` | Git 状态、可选的 cache-breaker 内容 | 作为额外文本附到有效 system prompt 末尾 |
| 会话消息 | 已有 transcript、本轮新用户消息以及先前工具结果 | `messages` 数组 |

这里的“项目上下文”主要指由 `getMemoryFiles()` 发现并经 `getClaudeMds()` 整理的指令文件，例如项目 `CLAUDE.md`、`.claude/CLAUDE.md` 和 `.claude/rules/*.md`。`getUserContext()` 还会收集用户级、托管等 memory 来源，并加入当前日期；因此 `userContext` 不等同于单独一份项目文件。会话 transcript 则仍然是 `messages`，不会被拼进 system prompt。

## REPL 组装一次查询的输入

交互 REPL 在 `onQuery()` 中并行获取默认提示、基础 user context 与 system context。随后把 coordinator context 和符合条件的 terminal focus 状态合并进 `userContext`，再用 `buildEffectiveSystemPrompt()` 按当前模式与配置选择有效提示。REPL 最终把 `messagesIncludingNewMessages`、`systemPrompt`、`userContext` 和 `systemContext` 作为分开的字段传给 `query()`。

~~~mermaid
flowchart TD
  A[REPL.onQuery] --> B[并行获取三类输入]
  B --> C[getSystemPrompt 默认提示]
  B --> D[getUserContext 基础用户上下文]
  B --> E[getSystemContext 系统上下文]
  C --> F[buildEffectiveSystemPrompt]
  D --> G[合并 coordinator 和 terminal focus context]
  A --> H[已有 transcript 加本轮新消息]
  F --> I[query 参数]
  G --> I
  E --> I
  H --> I
  I --> J[queryLoop]
  J --> K[appendSystemContext]
  J --> L[prependUserContext]
  K --> M[deps.callModel]
  L --> M
~~~

## 默认提示与有效提示的选择

`getSystemPrompt()` 在 `constants/prompts.ts` 中按当前工具、模型、设置和功能分支生成字符串数组。标准路径把身份与行为说明、工具说明和其他 prompt sections 组织为多个片段；`CLAUDE_CODE_SIMPLE` 和 proactive 等路径会返回各自的提示形态。

`buildEffectiveSystemPrompt()` 再决定哪些片段生效，主要顺序如下：

| 优先顺序 | 生效内容 |
| --- | --- |
| 最高 | 显式 `overrideSystemPrompt`，独自成为提示；这条路径不再追加 `appendSystemPrompt` |
| 其次 | 满足条件时使用 coordinator prompt |
| 有 Agent 时 | 主线程 Agent prompt 优先于 custom/default；proactive 模式下把 Agent 指令附加到默认提示，否则使用 Agent prompt 替代它们 |
| 无 Agent 时 | `customSystemPrompt`（例如 `--system-prompt`）优先于默认提示 |
| 默认 | `getSystemPrompt()` 生成的 Claude Code 提示 |

除显式 override 外，`appendSystemPrompt` 会附加在选中的提示之后。coordinator 分支和 proactive Agent 分支也保留这段追加内容。

## 两类 context 的来源和注入点

`context.ts` 的 `getUserContext()` 与 `getSystemContext()` 都是 memoized 的映射。`getUserContext()` 根据禁用设置和 bare 模式决定是否加载 memory files；允许加载时会把文件整理为 `claudeMd`，并始终提供 `currentDate`。memory files 可来自托管、用户、项目和本地指令源；功能开启时还可能包含 AutoMem 或 TeamMem。是否包含项目文件受运行选项和设置影响。

`getSystemContext()` 在本地且启用 Git 指令时可加入 `gitStatus`，内容是会话启动时采集的分支、状态和近期提交快照；远程会话或关闭 Git 指令时跳过这步。特定功能开启且设置了 injection 时，还会加入 `cacheBreaker`。

`query.ts` 在每次模型调用准备参数时分别处理它们：

- `appendSystemContext(systemPrompt, systemContext)` 把各个 `key: value` 拼成额外的 system prompt 片段。
- `prependUserContext(messagesForQuery, userContext)` 创建一条 `isMeta: true` 的 user 消息，用 `<system-reminder>` 包住上下文，再放到会话消息之前。
- 原始会话消息保持独立，之后和这条 meta 消息一起作为 `messages` 传给 `deps.callModel()`。

因此 `context.ts` 里的两个 getter 名称虽然相近，却对应不同请求位置；`userContext` 也不是用户刚输入的那条消息。

## 静态提示片段与缓存边界

默认提示由多个 prompt sections 组成。`systemPromptSection()` 创建的 section 会由 registry 缓存；`DANGEROUS_uncachedSystemPromptSection()` 表示该 section 每轮重算。标准提示生成路径采用全局缓存分段时，`getSystemPrompt()` 在静态片段和动态片段之间放入 `SYSTEM_PROMPT_DYNAMIC_BOUNDARY`；前文提到的 simple/proactive 分支可能采用不同结构。`splitSysPromptPrefix()` 识别这个标记，将标记前后的内容分成不同缓存范围；context 的实际追加仍由 query 请求组装完成。其他路径会按对应的 provider/cache 选项处理提示块。

这个边界用于提示缓存，不是会话消息分隔符，也不是另一种 context 类型。

## 静态观察

在仓库根目录执行以下命令，只读取源码：

~~~sh
nl -ba engine/claude-code-analysis-main/src/context.ts | sed -n '20,34p;36,111p;113,189p'
nl -ba engine/claude-code-analysis-main/src/utils/claudemd.ts | sed -n '1,26p;790,846p;849,960p;979,1007p;1153,1194p'
nl -ba engine/claude-code-analysis-main/src/constants/prompts.ts | sed -n '105,115p;444,577p'
nl -ba engine/claude-code-analysis-main/src/constants/systemPromptSections.ts | sed -n '16,67p'
nl -ba engine/claude-code-analysis-main/src/utils/systemPrompt.ts | sed -n '28,123p'
nl -ba engine/claude-code-analysis-main/src/screens/REPL.tsx | sed -n '2767,2803p'
nl -ba engine/claude-code-analysis-main/src/query.ts | sed -n '449,451p;650,666p'
nl -ba engine/claude-code-analysis-main/src/utils/api.ts | sed -n '321,474p'
~~~

## 观察结果

在 REPL 中，默认提示、`userContext` 和 `systemContext` 并行准备，之后与会话消息一起进入 `query()`。`queryLoop` 将 `systemContext` 并到 system prompt，将 `userContext` 包成 meta user message 放在 transcript 前，再把二者与消息数组交给模型调用。这样可以从 `REPL.onQuery()` 与 `query.ts` 两处核对“收集 context”到“实际注入请求”的边界。

## 简化与限制

- 本课跟踪交互 REPL 的常规 Query 路径；Print/SDK 的 side question、子 Agent 和压缩请求可能通过其他入口组装同类参数。
- context 的具体内容会随当前目录、CLAUDE.md 启用设置、Git 状态、功能开关、Agent 模式和用户配置变化。
- 结论来自当前源码静态阅读；没有运行 CLI，也没有捕获特定环境下真实发送到 API 的提示内容。
