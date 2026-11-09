# 第 00 课：源码快照边界与整体分层

**目标：** 确认 `engine/claude-code-analysis-main` 当前提供哪些源码和构建信息，并沿交互主链画出模块分层。先分清静态源码证据与运行时证据，避免把目录名当成完整架构。

## 本课要回答的问题

1. 目标目录里实际有哪些文件，源码规模如何？
2. 当前快照能否独立安装、构建和运行？
3. 从 CLI 启动到一次工具调用，主要经过哪些模块？
4. 哪些结论可以由当前源码确认，哪些需要完整构建环境才能验证？

## 目录检查

在仓库根目录执行：

~~~sh
find engine/claude-code-analysis-main -maxdepth 1 -mindepth 1 -print | sort
rg --files engine/claude-code-analysis-main/src | wc -l
find engine/claude-code-analysis-main/src -mindepth 1 -maxdepth 1 -type d | sort
git status --short -- engine/claude-code-analysis-main/src.zip
~~~

本次检查结果：

- 目标目录展开后有 `src/` 和 `.DS_Store`，源码树有 **1902 个文件**。
- 没有 `package.json`、锁文件、`tsconfig` 或目标目录 README，无法从当前目录恢复安装依赖和构建命令。
- Git 将 `engine/claude-code-analysis-main/src.zip` 显示为已删除；本课按当前工作树记录这一点，不据此推断删除原因，也不恢复归档。

目录结构包含 `entrypoints/`、`cli/`、`commands/`、`screens/`、`components/`、`state/`、`query/`、`services/`、`tools/`、`hooks/`、`plugins/`、`skills/`、`utils/` 等。目录名称只用于建立索引，职责关系仍要由调用代码验证。

## 主链分层

~~~mermaid
flowchart LR
  A[entrypoints/cli.tsx] --> B[main.tsx 命令与模式分发]
  B --> C[replLauncher.tsx]
  C --> D[screens/REPL.tsx]
  D --> E[query.ts]
  E --> F[services/api/claude.ts 模型流]
  E --> G[services/tools 工具编排]
  G --> H[权限检查与工具执行]
  H --> I[tool_result]
  I --> E
  D <--> J[state 与 components]
~~~

## 源码证据

- `engine/claude-code-analysis-main/src/entrypoints/cli.tsx`：检查少量快速分支；常规路径动态加载 `main.tsx`。
- `engine/claude-code-analysis-main/src/main.tsx`：设置 Commander 命令；常规会话路径可进入 `launchRepl`。
- `engine/claude-code-analysis-main/src/replLauncher.tsx`：动态加载 `components/App.tsx` 和 `screens/REPL.tsx`。
- `engine/claude-code-analysis-main/src/screens/REPL.tsx`：准备会话上下文并消费 `query()` 生成的事件。
- `engine/claude-code-analysis-main/src/query.ts`：请求模型流；收到工具调用时，经工具编排产生结果并决定是否继续请求。
- `engine/claude-code-analysis-main/src/query/deps.ts`、`engine/claude-code-analysis-main/src/services/tools/toolOrchestration.ts`：分别标出模型请求依赖和工具分发入口。

## 观察结果

当前学习对象是可静态阅读的 TypeScript/TSX 源码树，不是可独立构建的完整 CLI 工程。交互主链的阅读顺序为：

~~~text
CLI entrypoint → command/mode routing → REPL → query loop
  → model stream or tool orchestration → tool result → query loop
~~~

后续课程从这条主链展开：先读启动与 REPL，再读 Query、权限和工具；扩展系统按需补充。

## 范围与限制

- 1902 是本次 `rg --files` 对当前源码树的计数，目录变化后可能不同。
- 当前没有构建清单和依赖锁定信息，本课不声称已编译或运行 Claude Code。
- 源码含 `bun:bundle` 的构建期 Feature 分支；完整源文件中存在的分支不一定会进入某个具体构建产物。
- 本课只建立目录和调用入口地图，不解释 API 协议、权限算法或工具的内部行为；这些主题在后续课中跟读。
