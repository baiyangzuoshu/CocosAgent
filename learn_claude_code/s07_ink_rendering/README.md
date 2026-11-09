# 第 07 课：Ink 终端界面树与渲染

**目标：** 从 REPL 组件组合开始，追踪 React 树如何经 Ink 的自定义 reconciler 和 Yoga 布局变成屏幕帧，再被转换成终端差分输出。

## 本课要回答的问题

1. `launchRepl()` 交给 root 的 React 树包含什么？业务 `App` 在其中负责什么？
2. `ink.ts`、`root.ts` 与 Ink 实例如何把 React 节点交给自定义 renderer？
3. Ink 的 host 节点和 Yoga 布局如何连接？
4. `renderer.ts` 生成的 `Frame` 怎样变成终端输出？

## 从 React 树到终端的主链

~~~mermaid
flowchart TD
  A[launchRepl: App 包含 REPL] --> B[renderAndRun: root.render]
  B --> C[ink.ts: 外包 ThemeProvider]
  C --> D[Ink.render: 内部 App 与 TerminalWriteProvider]
  D --> E[React reconciler 更新 Ink DOM 树]
  E --> F[resetAfterCommit: Yoga 计算布局]
  F --> G[Ink.onRender 调用 renderer]
  G --> H[DOM 树写入 Output 与 Screen]
  H --> I[Frame: screen / viewport / cursor]
  I --> J[LogUpdate 对比前后帧]
  J --> K[writeDiffToTerminal]
~~~

`launchRepl()` 构造业务树 `<App><REPL /></App>`。这里的 `src/components/App.tsx` 是应用上下文包装器：它提供 AppState、Stats 和 FPS metrics；实际交互界面由 `REPL` 子树承载。`renderAndRun()` 调用 `root.render(element)` 并等待 root 退出。

渲染入口再叠加两层 Ink 包装：`src/ink.ts` 让公开的 `render()` 和 `createRoot().render()` 自动使用 `ThemeProvider`；Ink 实例的 `render()` 则用内部终端 `App` 和 `TerminalWriteProvider` 包裹节点，补上 stdin/stdout、键盘与终端交互上下文。

## reconciler 建立 Ink 树

Ink 不把 React 树交给浏览器 DOM。`src/ink/ink.tsx` 创建自定义 `react-reconciler` container，`src/ink/reconciler.ts` 的 host config 将 React host element 映射到自己的 `DOMElement` 和 `TextNode`。节点属性与样式写入 Ink 节点；增删改节点会维护父子树并标记受影响节点。

`Ink` 实例创建 `ink-root` 节点，并为它安装 `onComputeLayout`、`onRender` 回调。React commit 结束时，`resetAfterCommit()` 先调用布局回调；Ink 将 root 宽度设为终端列数并执行 Yoga `calculateLayout()`，再安排一次 Ink 绘制。

~~~mermaid
sequenceDiagram
  participant React as React reconciler
  participant Host as Ink host config
  participant Tree as Ink DOM 与 Yoga
  participant Ink as Ink 实例
  React->>Host: 创建或更新 host 节点
  Host->>Tree: 修改节点、样式并标记 dirty
  React->>Ink: resetAfterCommit(rootNode)
  Ink->>Tree: 按终端宽度计算 Yoga 布局
  Ink->>Ink: scheduleRender / onRender
~~~

## renderer 生成屏幕帧

`createRenderer(rootNode, stylePool)` 返回逐帧 renderer。它读取 root 的 Yoga 计算尺寸及终端宽高；布局尚未就绪或尺寸无效时返回空帧。否则它复用 `Output`，调用 `renderNodeToOutput()` 将树内容排入输出缓冲，再通过 `output.get()` 得到屏幕 cell 缓冲，并把 screen、viewport、cursor 组合成 `Frame`。

renderer 根据前一帧和当前帧参数使用屏幕缓冲；对备用屏幕（alt-screen）还会限制帧高并调整光标位置。`renderer.ts` 的工作到生成 `Frame` 为止，它本身不直接向 stdout 写 ANSI 字符。

## 帧差分与终端写入

`Ink.onRender()` 将 front/back frame、终端尺寸、TTY 和 alt-screen 状态传给 renderer。随后 `LogUpdate.render()` 比较前一帧与新帧，Ink 交换缓冲区，并把优化后的差分交给 `writeDiffToTerminal()`。因此 React 更新、屏幕帧绘制和物理终端写入是连续但分层的步骤。

## 静态观察

在仓库根目录执行以下命令，只读取源码，不启动 CLI：

~~~sh
nl -ba engine/claude-code-analysis-main/src/replLauncher.tsx | sed -n '12,22p'
nl -ba engine/claude-code-analysis-main/src/interactiveHelpers.tsx | sed -n '94,103p'
nl -ba engine/claude-code-analysis-main/src/components/App.tsx | sed -n '15,55p'
nl -ba engine/claude-code-analysis-main/src/ink.ts | sed -n '12,31p'
nl -ba engine/claude-code-analysis-main/src/ink/root.ts | sed -n '125,157p'
nl -ba engine/claude-code-analysis-main/src/ink/ink.tsx | sed -n '233,269p;420,449p;585,595p;735,737p;1442,1454p'
nl -ba engine/claude-code-analysis-main/src/ink/reconciler.ts | sed -n '247,315p;331,372p;391,459p'
nl -ba engine/claude-code-analysis-main/src/ink/renderer.ts | sed -n '29,40p;48,82p;84,112p;129,177p'
~~~

## 观察结果

终端 UI 不是 React DOM 的像素界面：React reconciler 先维护 Ink 自己的 host 树，Yoga 给出终端单元格布局，renderer 将节点绘成屏幕帧，Ink 再计算帧差并写给终端。`src/components/App.tsx` 负责应用级 Provider 组合；`src/ink/ink.tsx` 中同名的内部 App 负责终端交互上下文，两者职责不同。

## 简化与限制

- 本课追踪交互主界面的树和一帧的渲染出口，不展开 REPL 子树中的每类消息组件、事件分发、滚动优化或 ANSI 编码细节。
- Yoga 计算、React reconciler 与终端输出只根据源码调用关系描述；没有在目标终端中运行或验收。
- 结论以当前 `engine/claude-code-analysis-main/src/` 静态源码快照为依据。
