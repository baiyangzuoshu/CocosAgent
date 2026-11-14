# 第 08 课：REPL 建立与首轮会话上下文

**目标：** 从交互入口创建 root 开始，追踪 App 与 REPL 的组装，分清恢复 transcript、CLI 初始提示和 SessionStart Hook 消息如何进入首次渲染与首个请求之前。

## 本课要回答的问题

1. 交互 root 在主流程的哪个阶段创建，`launchRepl()` 收到哪些应用级和 REPL 级数据？
2. 新会话的 `initialMessage`、`initialMessages` 和 `pendingHookMessages` 分别承担什么职责？
3. 恢复会话怎样把已加载 transcript 交给 REPL？
4. 首次渲染后，CLI 初始提示如何等待必要的 Hook 上下文再进入提交路径？

## 一条交互启动路径

~~~mermaid
flowchart TD
  A[main: 交互分支创建 root] --> B[setup screens 与启动准备]
  B --> C[main: 组装 initialState 和 REPL props]
  C --> D{会话入口}
  D -->|新会话| E[AppState.initialMessage: CLI 提示]
  D -->|恢复| F[REPL.initialMessages: 已加载 transcript]
  C --> G[SessionStart Hook 消息或未完成的 Promise]
  E --> H[launchRepl: 组装 App 与 REPL]
  F --> H
  G --> H
  H --> I[renderAndRun: root.render]
  I --> J[REPL: messages 从 initialMessages 初始化]
  J --> K{有待处理 initialMessage 且非 loading?}
  K -->|否| L[显示当前 transcript 与输入界面]
  K -->|是| M[消费 initialMessage，按需清理上下文]
  M --> N[等待 pending hooks]
  N --> O{字符串普通提示?}
  O -->|是| P[onSubmit，进入普通提交入口]
  O -->|复杂内容或 plan| Q[直接 onQuery，保留消息结构]
~~~

## main 交付启动数据

`main.tsx` 只在交互会话分支创建 Ink root，并先运行需要显示的 setup screens。进入常规 REPL 分支时，主流程已准备 `initialState` 与 `sessionConfig`，再调用 `launchRepl()`。

新会话中，CLI 的 `inputPrompt` 被封装成 `initialState.initialMessage`；它是待处理的输入，不是 transcript 初始数组。SessionStart Hook 若已完成，Hook 消息会放进 `initialMessages`；若 Hook Promise 尚未完成，`pendingHookMessages` 被传给 REPL，让界面先挂载。

恢复会话则把加载得到的 `initialState` 和 `loaded.messages` 分别传入 App 与 REPL props。这样 REPL 可从 transcript 恢复可见消息，其他恢复数据（例如文件历史快照、内容替换记录和 Agent 名称）也通过独立 props 提供。

## launchRepl 与 REPL 的初始化

`launchRepl()` 动态导入 `App` 和 `REPL`，构造 `<App {...appProps}><REPL {...replProps} /></App>`，然后交给 `renderAndRun()`。后者调用 `root.render(element)`，启动 deferred prefetch，等待 root 退出，再执行 graceful shutdown。

`REPL` 的 props 类型区分初始 transcript 与尚未完成的 Hook Promise。组件挂载时，`messages` 用 `initialMessages ?? []` 初始化；`initialMessage` 则从 AppState 单独读取。`useDeferredHookMessages()` 在 Promise 完成时把结果并入消息列表，并返回一个可等待的回调，供首个 API 调用前确保 Hook 结果已进入上下文。

因此有三条不同的数据通道：

| 数据 | 传递位置 | REPL 中的用途 |
| --- | --- | --- |
| 已有 transcript 或已完成的初始消息 | `initialMessages` prop | 作为可见消息列表的初值 |
| CLI 初始提示 | `initialState.initialMessage` | 首屏挂载后等待处理的输入 |
| 尚未完成的 SessionStart Hook | `pendingHookMessages` prop | 解析后加入消息列表，并在首个 API 调用前等待 |

## 首个输入的处理时机

REPL 中的 effect 只在 `initialMessage` 存在、`isLoading` 为 false 且防重入标记未置位时启动。它先设置防重入标记；若请求要求清理上下文，就先清理对话，再通过 AppState 更新消费 `initialMessage`，避免 effect 重复处理。

随后流程等待 `awaitPendingHooks()`，确保 SessionStart Hook 的结果能进入首个 API 请求上下文。普通字符串内容经过 `onSubmit()`，以运行 UserPromptSubmit hooks 等标准提交逻辑；plan 消息或复杂内容则直接进入 `onQuery()`，以保留 plan metadata 或结构化内容。这里的追踪止于提交/查询入口，不展开 Query 循环。

~~~mermaid
sequenceDiagram
  participant Main as main.tsx
  participant REPL as REPL
  participant Hooks as SessionStart Hooks
  participant Submit as onSubmit / onQuery
  Main->>REPL: initialState 与 REPL props
  REPL->>REPL: messages = initialMessages ?? []
  Main-->>REPL: pendingHookMessages Promise（可选）
  REPL->>REPL: 首屏 effect 检查 initialMessage 与 isLoading
  REPL->>Hooks: awaitPendingHooks()
  Hooks-->>REPL: Hook 结果进入消息列表
  REPL->>Submit: 普通文本走 onSubmit，特殊内容走 onQuery
~~~

## 静态观察

在仓库根目录执行以下命令，只读取源码，不启动 CLI：

~~~sh
nl -ba AI/claude-code-analysis-main/src/main.tsx | sed -n '2211,2242p;2926,3041p;3720,3806p'
nl -ba AI/claude-code-analysis-main/src/replLauncher.tsx | sed -n '7,22p'
nl -ba AI/claude-code-analysis-main/src/interactiveHelpers.tsx | sed -n '94,103p'
nl -ba AI/claude-code-analysis-main/src/screens/REPL.tsx | sed -n '526,570p;572,625p;1182,1202p;1310,1314p;3026,3141p'
nl -ba AI/claude-code-analysis-main/src/hooks/useDeferredHookMessages.ts | sed -n '4,45p'
~~~

## 观察结果

REPL 的首次会话上下文不是一个单独的消息数组：恢复 transcript 和已完成 Hook 消息可作为 `initialMessages` 展示；CLI 初始提示保留在 AppState 中，待 REPL 挂载且不处于 loading 后再消费；未完成的 SessionStart Hook 允许首屏先出现，但会在首个 API 调用前等待。三种输入最终在 REPL 内汇合，随后进入普通提交或查询路径。

## 简化与限制

- 本课聚焦常规交互新会话与恢复会话；Remote、SSH、assistant viewer 等入口会提供各自的连接配置或说明消息，不逐一拆解。
- 本课追踪到 `onSubmit()` / `onQuery()` 的入口为止；输入缓冲、命令队列、提示词构造和 Query 主循环分别留给后续课程。
- 结论来自当前源码快照，不代表已运行 Ink、触发真实 SessionStart hooks 或发送模型请求。
