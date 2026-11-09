# 第 06 课：AppState 与状态订阅

**目标：** 从一次 `setState()` 更新追踪状态容器、React 订阅和 `onChangeAppState` 副作用，并看权限模式变化如何同步到 SDK 与远程会话。

## 本课要回答的问题

1. `AppState` 保存哪些类型的会话状态，store 如何创建和持有它？
2. `setState()` 的更新顺序是什么，什么情况下会直接跳过通知？
3. React 组件如何只订阅自己使用的状态切片？
4. `onChangeAppState` 怎样把权限模式变化写入外部会话元数据和 SDK 消息？
5. 交互界面和 headless/SDK 路径是否使用同一状态变更回调？

## 一次状态更新的主链

`AppState` 是应用级状态快照，包含设置、模型、权限上下文、任务和界面选择等字段。交互树通过 `AppStateProvider` 创建 store；headless 路径也以 `createStore()` 建立状态容器。组件或业务逻辑调用 updater 后，通用 store 先比较对象身份并写入新状态，再运行差异回调，最后通知订阅者。

~~~mermaid
flowchart TD
  A[useSetAppState / store.setState] --> B[执行 updater: prev -> next]
  B --> C{Object.is(next, prev)?}
  C -->|是| D[不写入，也不通知]
  C -->|否| E[store.state = next]
  E --> F[onChangeAppState(newState, oldState)]
  F --> G[处理差异副作用]
  F --> H[权限模式变化: notify session metadata]
  H --> I[RemoteIO / CCR 报告 metadata]
  F --> J[notify permission mode]
  J --> K[SDK system:status 消息]
  G --> L[调用 store listeners]
  H --> L
  J --> L
  L --> M[useSyncExternalStore 重新读取 selector]
  M --> N{选中的快照变了吗?}
  N -->|是| O[React 组件重新渲染]
  N -->|否| P[组件保持当前渲染]
~~~

通知顺序是源码的一部分：`createStore.setState()` 先保存新状态、调用可选 `onChange`，然后逐个调用订阅监听器。`onChangeAppState` 的持久化或外部同步副作用因此发生在 React 订阅者收到通知之前。

## Store 与 React 订阅

- `AppStateStore.ts` 定义 `DeepImmutable<AppState>` 和默认状态。字段包括 `toolPermissionContext`、模型设置、MCP 连接、任务及 UI 选择等；它描述应用状态形状，不实现 React 订阅。
- `AppStateProvider` 用 `useState` 的惰性初始化创建 store，初始值来自 `initialState` 或 `getDefaultAppState()`；该 store 在 Provider 生命周期内保持稳定，并通过 Context 提供给组件。
- `createStore()` 保存一个状态值和一组 listener。updater 返回与原状态相同的对象引用时，`Object.is` 命中并跳过回调与通知；因此更新应返回新的状态对象，而不是原地修改后返回原对象。
- `useAppState(selector)` 通过 `useSyncExternalStore(store.subscribe, get, get)` 订阅 selector 读取到的快照。只有选中值变化时组件才需要重新渲染；不要在 selector 中每次都构造新对象，否则对象身份会持续变化。
- `useSetAppState()` 只返回稳定的 updater，不订阅状态；只负责发起更新的组件不会因为该状态变化而自动重渲染。需要在非 React 代码读取或写入时，可通过 `useAppStateStore()` 取得 store。

## `onChangeAppState`：状态之外的副作用

交互入口由 `App` 把 `onChangeAppState` 传入 `AppStateProvider`；headless 入口直接把同一回调传给 `createStore()`。因此相同的业务状态变化可以由两个路径共享同一组差异处理。

回调逐项比较新旧快照，而不是把整个状态写入外部：

| 变化字段 | 回调行为 |
| --- | --- |
| `toolPermissionContext.mode` | 外部化权限模式并通知远程 metadata；另行通知 SDK 权限模式监听器 |
| `mainLoopModel` | 更新或清除用户设置中的 model，并同步 model override |
| `expandedView`、`verbose` | 转换为兼容设置字段并持久化 |
| `settings` | 清空 API key、AWS、GCP 凭据缓存；`settings.env` 改变时重新应用环境变量 |

权限模式同步是一个例子。`onChangeAppState` 把内部模式转成可外发名称；若内外部模式没有变化，就不发送重复的远程 metadata。模式变化时，它分别调用 `notifySessionMetadataChanged()` 和 `notifyPermissionModeChanged()`：`RemoteIO` 将前者交给 `CCRClient.reportMetadata()`；Print/SDK 路径监听后者并写入 `system:status` 消息。工作进程收到外部 metadata 时，`externalMetadataToAppState()` 可反向生成 updater 恢复权限模式和 Ultraplan 标志。

## 静态观察

在仓库根目录执行以下命令，只检查源码，不启动 CLI：

~~~sh
nl -ba engine/claude-code-analysis-main/src/state/AppStateStore.ts | sed -n '89,116p;454,511p'
nl -ba engine/claude-code-analysis-main/src/state/store.ts | sed -n '1,34p'
nl -ba engine/claude-code-analysis-main/src/state/AppState.tsx | sed -n '37,110p;126,179p'
nl -ba engine/claude-code-analysis-main/src/components/App.tsx | sed -n '15,35p'
nl -ba engine/claude-code-analysis-main/src/state/onChangeAppState.ts | sed -n '23,92p;94,170p'
nl -ba engine/claude-code-analysis-main/src/utils/sessionState.ts | sed -n '30,83p;136,150p'
nl -ba engine/claude-code-analysis-main/src/cli/remoteIO.ts | sed -n '159,167p'
nl -ba engine/claude-code-analysis-main/src/cli/print.ts | sed -n '1052,1079p;5052,5060p'
nl -ba engine/claude-code-analysis-main/src/main.tsx | sed -n '2652,2675p'
~~~

## 观察结果

状态更新先经过通用 store，再由中心回调处理跨模块副作用，最后通知 UI 订阅者。React 组件订阅的是状态选择器返回的快照，而不是整个 Provider 的 Context 值；因此 store 的 Context 保持稳定，具体切片变化才触发相关组件刷新。权限模式这个例子还说明同一个状态差异可以同时驱动持久化规则、SDK 消息和远程会话 metadata。

## 简化与限制

- 本课只追踪 store 写入、React 切片订阅和权限模式外部同步；不逐项解释庞大的 `AppState` 字段或每个 mutation 调用点。
- `DeepImmutable` 提供类型约束；通用 store 的运行时去重仍依据对象身份，不会克隆或深度比较状态。
- 结论来自当前源码快照，不代表已运行 React 渲染或远端 CCR/SDK 连接验收。
