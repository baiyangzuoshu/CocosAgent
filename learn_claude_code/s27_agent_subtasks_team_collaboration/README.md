# 第 27 课：Agent、子任务与团队协作

**目标：** 从 Agent 工具入口追踪普通子 Agent、后台任务和命名队友三条生命周期，画清楚消息、任务状态与取消信号分别怎样流动。

## 本课要回答的问题

1. Agent 工具在什么条件下启动普通子 Agent，什么条件下改走团队队友派发？
2. 同步子 Agent 和后台子 Agent 怎样共享或隔离父 Agent 的上下文？
3. Task 类型、运行状态与任务执行器分别负责什么？
4. 团队队友如何接收消息、继续工作并结束生命周期？

## 一张图看懂三条路径

~~~mermaid
flowchart TD
  A[模型提交 Agent tool_use] --> B[AgentTool.call]
  B --> C{解析到 teamName 且提供 name?}
  C -->|否| D[选择 AgentDefinition 并准备 runAgent 参数]
  D --> E{shouldRunAsync}
  E -->|否| F[runAgent 生成消息]
  F --> G[AgentTool 收集并 finalizeAgentTool]
  G --> H[completed tool_result 回到父 Query]
  E -->|是| I[注册 local_agent Task]
  I --> J[后台运行 runAgent]
  J --> K[completed / failed / killed 与任务通知]
  K --> L[后续消息或输出文件供父会话读取]
  C -->|是| M[spawnTeammate]
  M --> N{选择团队后端}
  N -->|in-process| O[登记队友 Task 与独立上下文]
  O --> P[持续运行的 inProcessRunner]
  P --> Q[runAgent 执行一轮]
  Q --> R[空闲时等待新消息或关闭请求]
  N -->|pane backend| S[启动外部队友并登记任务]
  P <--> T[SendMessage 与 teammate mailbox]
  S <--> T
  M --> U[teammate_spawned 立即返回]
  I --> V[AppState.tasks]
  O --> V
  S --> V
~~~

## AgentTool：先选执行模型，再决定同步或后台

AgentTool.call() 是分流入口。它先解析当前队伍名；当同时有队伍名和 name 时，调用 spawnTeammate()，并以 teammate_spawned 返回。只有 name、没有队伍上下文时，仍继续走普通子 Agent 路径。队友不能再创建命名队友；in-process 队友也不能创建后台子 Agent，因为这两种嵌套方式与各自的生命周期约束冲突。

普通子 Agent 会选择 Agent 定义、准备独立工具池与 runAgent 参数。是否后台运行由 run_in_background、Agent 定义的 background 标记以及若干运行模式开关共同决定，并非只看一个输入字段。

runAgent() 以异步生成器执行 Query。它为子 Agent 建立独立 ID、初始消息、工具集合和 ToolUseContext，写入 sidechain transcript，再逐条产出消息。createSubagentContext() 会克隆文件读取缓存和部分可变状态；普通同步 Agent 共享父级取消信号并参与父级状态更新，后台 Agent 使用独立取消控制器，普通 setAppState 回调不直接共享，但任务登记仍可经专用 root setter 写入根状态。权限提示也受同步 / 后台模式影响。

同步路径由 AgentTool 收集子 Agent 消息，finalizeAgentTool() 汇总文本、Token 与工具调用数，然后将 status: completed 映射成父 Query 的 tool_result。若 Agent 被标记为后台或运行时要求异步，工具会先登记 local_agent 任务，再脱离当前调用执行；父 Query 立刻收到 async_launched，完成、失败或取消会通过任务状态和通知回到会话。若启动时提供了 name，SendMessageTool 会把名字映射到 local_agent，并将新消息排入该任务的 pendingMessages，供 Agent 下一轮读取。

## 命名队友：共用 Agent 执行器，采用独立的团队生命周期

团队路由与普通 AgentTool 子任务不是同一个返回协议。spawnTeammate() 根据配置优先走 in-process，或检测并选择 tmux / iTerm2 pane 后端；自动模式在没有可用 pane 后端时可回退到 in-process。

in-process 创建过程会生成 name@team 身份和 task ID，建立队友的 AsyncLocalStorage 上下文及独立 AbortController，然后把状态登记到 AppState.tasks。派发器随即启动 inProcessRunner，并立刻向调用方返回 teammate_spawned。这里复用 runAgent() 和 Query 主循环，但 runner 会在一轮结束后进入空闲等待，收到新消息时再开始下一轮；它不是一个完成后就销毁的普通后台 Agent。

队友之间通过 SendMessage 发送文本或结构化消息。writeToMailbox() 用带锁的文件消息箱避免并发写入冲突，in-process runner 定期轮询消息箱，并在新提示、关闭请求或取消信号到来时恢复控制。pane 后端也保留任务记录，并通过对应后端结束 pane。因而，普通同步子 Agent 的主要交付是父 Query 的 tool_result；命名队友则通过队伍身份、消息和状态更新持续协作。

## Task：用统一状态记录长生命周期工作

TaskType 区分 local_agent、remote_agent、in_process_teammate、local_bash 等任务；TaskStatus 统一为 pending、running、completed、failed、killed。TaskStateBase 存任务 ID、描述、起止时间、输出文件偏移和通知标志。基础构造器默认 pending，具体启动路径会在登记时改成 running。

registerTask() 把 task state 写入 AppState.tasks 并发出任务开始事件；isTerminalTaskStatus() 把完成、失败、取消视为终态。普通后台 Agent 由 LocalAgentTask 创建和收束；in-process 队友的专用终止函数会中止控制器、清理队伍成员和临时输出，再将状态置为 killed。runner 在正常退出或异常时分别标记 completed、failed，并检查任务是否已被终止，避免把 killed 又覆盖成 completed。

要注意 Task 与 TaskState 的职责不同：Task 是按类型分发 kill 操作的执行器接口，TaskState 才是 AppState.tasks 中可观察的运行记录。getAllTasks() 返回可分发的 kill 实现；它不等同于所有 TaskType 的完整清单，in-process teammate 还有自己的 backend 终止路径。

## 静态观察

在仓库根目录执行以下命令，只读取源码：

~~~sh
nl -ba AI/claude-code-analysis-main/src/tools/AgentTool/AgentTool.tsx | sed -n '239,316p;318,367p;555,635p;686,764p;765,832p;1205,1261p;1298,1340p'
nl -ba AI/claude-code-analysis-main/src/tools/AgentTool/runAgent.ts | sed -n '347,375p;520,543p;697,715p;747,859p'
nl -ba AI/claude-code-analysis-main/src/tools/AgentTool/agentToolUtils.ts | sed -n '276,355p'
nl -ba AI/claude-code-analysis-main/src/utils/forkedAgent.ts | sed -n '345,455p'
nl -ba AI/claude-code-analysis-main/src/Task.ts | sed -n '6,29p;44,57p;69,124p'
nl -ba AI/claude-code-analysis-main/src/tasks.ts | sed -n '17,39p'
nl -ba AI/claude-code-analysis-main/src/tasks/LocalAgentTask/LocalAgentTask.tsx | sed -n '466,514p;526,575p;657,680p'
nl -ba AI/claude-code-analysis-main/src/utils/task/framework.ts | sed -n '44,117p'
nl -ba AI/claude-code-analysis-main/src/tools/shared/spawnMultiAgent.ts | sed -n '840,938p;1040,1093p'
nl -ba AI/claude-code-analysis-main/src/utils/swarm/spawnInProcess.ts | sed -n '104,204p;221,327p'
nl -ba AI/claude-code-analysis-main/src/utils/swarm/inProcessRunner.ts | sed -n '870,920p;1159,1204p;1419,1515p'
nl -ba AI/claude-code-analysis-main/src/tools/SendMessageTool/SendMessageTool.ts | sed -n '149,175p;741,825p'
nl -ba AI/claude-code-analysis-main/src/utils/swarm/backends/InProcessBackend.ts | sed -n '145,180p'
nl -ba AI/claude-code-analysis-main/src/utils/teammateMailbox.ts | sed -n '134,182p'
~~~

## 观察结果

- AgentTool 是分发点：普通子 Agent 的最终结果回到父 Query；团队队友会先返回已启动状态，再通过消息和任务状态持续协作。
- 普通子 Agent 与团队队友都能复用 runAgent()，但上下文共享方式、取消范围和完成后的生命周期不同。
- TaskType、TaskStatus、TaskState 和按类型执行的 Task.kill() 是相关但不同的层次。
- 队友通信通过带身份的消息箱，取消和完成由任务状态及后端清理逻辑收束。

## 范围与限制

- 本课聚焦 Agent、Task 与 Agent Swarms 的主要源码路径，不展开 Agent 配置发现、每种 pane 后端、消息协议的所有结构类型或团队任务列表 UI。
- 结论来自当前源码快照的静态阅读；未运行 CLI、未验证模型调用、消息箱竞争行为、权限提示、tmux / iTerm2 窗口或目标平台运行时。
