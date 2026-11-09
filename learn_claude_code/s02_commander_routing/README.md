# 第 02 课：Commander 参数解析与命令分发

**目标：** 看清完整 CLI 怎样构造 Commander 根命令、注册共享选项和子命令，再由 `parseAsync()` 将参数交给默认会话 action 或具体子命令 action。

## 本课要回答的问题

1. 根命令、可选 prompt 和全局选项在哪里注册？
2. 普通输入与 `mcp`、`auth`、`plugin` 等子命令怎样分流？
3. `--print` 为什么会提前跳过子命令注册？
4. `preAction` 和具体 action 的执行关系是什么？

## 本课调用链

第 01 课的 `entrypoints/cli.tsx` 动态加载 `main.tsx` 后，`main()` 调用 `run()`。`run()` 先创建根命令和默认会话 action，再根据参数决定是否注册子命令，最后执行 Commander 的异步解析。

~~~mermaid
flowchart TD
  A[main.tsx main] --> B[run 创建 Commander]
  B --> C[注册根命令、可选 prompt、共享选项]
  C --> D[注册默认会话 action 与 version]
  D --> E{含 --print 且不是 cc:// URL?}
  E -- 是 --> F[parseAsync 走默认会话 action]
  E -- 否 --> G[注册 mcp/auth/plugin 等子命令]
  G --> H[parseAsync 分派参数]
  F --> I[preAction]
  H --> I
  I --> J{选中的 action}
  J -- 无子命令 --> K[默认会话 action]
  J -- 有子命令 --> L[子命令 action]
~~~

`preAction` 在真正执行 action 前运行；显示帮助等没有进入命令 action 的路径不会触发它。初始化钩子的具体步骤留在第 03 课。

## 源码对照

- `engine/claude-code-analysis-main/src/main.tsx:884-903`：`run()` 创建并配置 Commander 根命令。
- `engine/claude-code-analysis-main/src/main.tsx:905-967`：注册根级 `preAction`，在 action 前完成公共准备。
- `engine/claude-code-analysis-main/src/main.tsx:968-1006`：设置命令名称、说明、可选 `[prompt]`、帮助和大量根级选项，并定义默认 action。
- `engine/claude-code-analysis-main/src/main.tsx:977-1000`：若干选项带有 choices、数值解析器或范围校验；比如预算参数会先转换并拒绝无效输入。
- `engine/claude-code-analysis-main/src/main.tsx:3808-3812`：根命令注册 `--version` 和工作树选项。入口层只拦截独立版本参数，Commander 仍提供完整命令解析里的版本选项。
- `engine/claude-code-analysis-main/src/main.tsx:3875-3890`：检测 `--print`。非 `cc://` URL 的 Print 路径直接解析并返回，跳过后续子命令注册。
- `engine/claude-code-analysis-main/src/main.tsx:3892-3916`、`4100-4148`：注册 `mcp`、`auth`、`plugin` 等子命令，并连接相应 action 或注册函数。
- `engine/claude-code-analysis-main/src/main.tsx:4503-4505`：常规路径完成子命令注册后调用 `program.parseAsync(process.argv)`。

## 分支观察

| 输入形态 | 解析路径 | 结果 |
| --- | --- | --- |
| `claude "解释这段代码"` | 根命令的可选 `[prompt]` 和默认 action | 进入默认会话处理 |
| `claude -p "解释这段代码"` | 根选项和默认 action 已注册；随后提前解析返回 | Print 不需要先构造后面的子命令树 |
| `claude mcp serve` | 注册 `mcp` 和 `serve` 后再解析 | 进入 `mcp serve` action；处理器在 action 中动态导入 |
| `claude auth status` | 注册 `auth` 子命令及 `status` action | 命令 action 前先经过根级 `preAction` |
| `claude --print cc://...` | `isCcUrl` 阻止 Print 快速解析 | 继续注册 `open` 等子命令，使 URL 路由可用 |
| `claude --max-budget-usd abc` | 选项解析器先验证参数 | 无效值在默认 action 执行前被拒绝 |

`--plugin-dir` 展示了根选项如何服务子命令：`preAction` 从当前命令读取根选项并设置 inline plugin 路径，因为子命令自己的 action 不会收到默认会话 action 的 `options` 对象。

## 静态观察

在仓库根目录执行以下命令，按行查看命令构造、Print 分支和最终解析点；这些命令只读取源码：

~~~sh
nl -ba engine/claude-code-analysis-main/src/main.tsx | sed -n '902,970p'
nl -ba engine/claude-code-analysis-main/src/main.tsx | sed -n '3873,3900p'
nl -ba engine/claude-code-analysis-main/src/main.tsx | sed -n '4498,4506p'
rg -n "program\.command\('(mcp|auth|plugin)'|parseAsync\(process\.argv\)" engine/claude-code-analysis-main/src/main.tsx
~~~

## 观察结果

`main.tsx` 集中定义根选项、默认会话 action 和子命令树；具体功能则常被交给延迟导入的 handler。Print 模式在子命令树构造前完成根命令解析，其他路径先注册子命令，再统一解析参数。

## 简化与限制

- 这里只解释 Commander 注册顺序和静态分支，不执行 CLI，也不把某个 Feature 构建里的命令列表外推到其他构建。
- 根命令选项很多，本课只选 prompt、Print、预算校验和 plugin-dir 作为解析示例。
- 本课不展开 `preAction` 内部初始化，也不跟进默认 action 的 REPL/Print 业务；后续课程分别处理这些主题。
