# 第 01 课：CLI 轻量入口与快速分支

**目标：** 看清 `entrypoints/cli.tsx` 如何在完整 CLI 模块加载之前处理版本查询和专用入口，以及普通启动如何延迟加载 `main.tsx`。

## 本课要回答的问题

1. 为什么 `--version` 可以在加载完整 CLI 前返回？
2. 特殊参数如何选择专用服务或后台入口？
3. 普通 CLI 路径何时开始加载 `main.tsx`？
4. `feature()` 和运行时参数分别控制什么？

## 本课调用链

模块导入时先设置少量环境变量；随后 `main()` 检查参数。命中快速分支就动态加载对应处理器并结束；未命中时捕获早期输入，再加载完整 CLI。

~~~mermaid
flowchart TD
  A[cli.tsx 模块载入] --> B[设置启动期环境变量]
  B --> C[main 读取 argv]
  C --> D{仅有 --version/-v/-V?}
  D -- 是 --> E[输出版本并返回]
  D -- 否 --> F[动态加载启动分析器]
  F --> G{命中特殊入口?}
  G -- 是 --> H[动态加载专用处理器并返回]
  G -- 否 --> I[整理参数与启动标记]
  I --> J[开始捕获早期输入]
  J --> K[动态加载 main.tsx]
  K --> L[调用完整 CLI]
~~~

`--worktree --tmux` 是一个有条件的例外：只有工作树模式实际接管后才返回；若未接管，则继续进入完整 CLI。

## 源码对照

- `AI/claude-code-analysis-main/src/entrypoints/cli.tsx:1-26`：在 `main()` 前设置 Corepack、远程子进程堆上限和受构建特性控制的环境开关。
- `AI/claude-code-analysis-main/src/entrypoints/cli.tsx:28-48`：`main()` 先取命令行参数；精确匹配单独的版本参数时直接打印并返回。该分支不会动态加载启动分析器。
- `AI/claude-code-analysis-main/src/entrypoints/cli.tsx:50-245`：按参数和 `feature()` 结果分发提示词导出、浏览器/MCP、后台 Worker、远程控制、后台会话和其他专用入口。
- `AI/claude-code-analysis-main/src/entrypoints/cli.tsx:247-285`：尝试提前接管 tmux 工作树路径；将 `--update`/`--upgrade` 改写成子命令，并在加载主模块之前设置 `--bare` 对应的环境变量。
- `AI/claude-code-analysis-main/src/entrypoints/cli.tsx:287-302`：常规路径开始捕获早期输入，动态导入 `main.js` 并调用 `cliMain()`；文件末尾以 `void main()` 启动入口。
- `AI/claude-code-analysis-main/src/main.tsx:585-586`、`851-855`：完整 CLI 的 `main()` 随后进入 `run()`。

## 分支观察

| 输入或条件 | 入口行为 | 观察重点 |
| --- | --- | --- |
| 唯一参数为 `--version`、`-v` 或 `-V` | 打印内联版本并返回 | 检查条件包含 `args.length === 1`；带其他参数时不会走这条分支 |
| `--dump-system-prompt` 且构建包含对应特性 | 延迟导入配置、模型和提示词模块，输出后返回 | `feature()` 是构建特性边界 |
| `remote-control`、`daemon`、`--daemon-worker`、后台会话等 | 延迟导入相应处理器并提前分发 | 专用路径并非都跳过配置或认证；逐条看它自己的准备步骤 |
| `--worktree --tmux` | 条件接管；未处理时回落 | 该路径不是无条件短路 |
| 普通参数或 `--bare` | 捕获早期输入，加载 `main.tsx` | `--bare` 在完整模块求值前写入环境，避免设置过晚 |

## 静态观察

在仓库根目录执行以下命令，按代码顺序核对分支；它们只读取源码，不启动 CLI：

~~~sh
nl -ba AI/claude-code-analysis-main/src/entrypoints/cli.tsx | sed -n '28,72p'
nl -ba AI/claude-code-analysis-main/src/entrypoints/cli.tsx | sed -n '247,302p'
rg -n "feature\(|startCapturingEarlyInput|import\('../main.js'\)|await cliMain" AI/claude-code-analysis-main/src/entrypoints/cli.tsx
~~~

## 观察结果

入口把启动工作分成两层：`cli.tsx` 负责小型快速分支和按需导入；`main.tsx` 负责完整命令行程序。版本查询最短，普通会话最晚才加载主 CLI；某条特殊分支是否存在，还受构建特性和运行时参数共同影响。

## 简化与限制

- 当前源码快照没有 `package.json` 和构建配置，本课只核对静态分支，不执行 `claude --version` 或其他命令。
- 源文件里的 `feature()` 分支不等于所有发布构建都会包含该代码；具体构建结果需要对应的 Bun 打包配置和产物。
- 本课不展开完整 CLI 的 Commander 注册、初始化和 REPL 启动；下一课沿 `main.tsx` 继续追踪。
