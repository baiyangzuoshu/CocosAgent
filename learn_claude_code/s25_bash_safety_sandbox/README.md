# 第 25 课：Bash 命令、安全校验与 Sandbox

**目标：** 沿一条 Bash 工具调用追踪输入、静态分析、权限决策、Sandbox 包裹和结果解释，区分“允许执行”和“在 Sandbox 中执行”两件事。

## 本课要回答的问题

1. `BashTool` 对外暴露哪些输入，哪些字段只供内部使用？
2. `bashToolHasPermission()` 如何处理可解析、过于复杂和无法解析的命令？
3. 权限自动放行与 `shouldUseSandbox()` 分别由什么条件控制？
4. 命令如何从 `exec()` 进入 Sandbox 适配层，结果又如何变成工具错误？

## 一次 Bash 调用的分层路径

~~~mermaid
flowchart TD
  A[模型提交 Bash 输入] --> B[Schema 与 validateInput]
  B --> C[bashToolHasPermission]
  C --> D{静态解析结果}
  D -->|simple| E[语义检查与命令结构]
  D -->|too-complex| F[检查早期 deny 规则，否则 ask]
  D -->|parse-unavailable| G[旧解析路径；语法错误时 ask]
  E --> H{Sandbox 自动放行条件满足？}
  G --> H
  H -->|满足| I[仍检查显式 deny / ask]
  H -->|不满足| J[权限规则、classifier、operator 与路径检查]
  I --> K[允许、拒绝或请求确认]
  J --> K
  K -->|allow| L[runShellCommand]
  L --> M[shouldUseSandbox]
  M --> N[Shell.exec 与 provider]
  N --> O[SandboxManager.wrapWithSandbox]
  O --> P[子进程结果与 Sandbox 违规标注]
  P --> Q[interpretCommandResult 与错误映射]
~~~

图中“Sandbox 自动放行”属于 Bash 权限决策的一条捷径；`shouldUseSandbox()` 则决定实际执行命令是否交给 Sandbox 包裹。两个判断相关，但职责不同。

## 输入与前置校验

`BashTool` 的公开 Schema 包含命令、超时、描述、后台运行标志和 `dangerouslyDisableSandbox`。`_simulatedSedEdit` 是内部字段，Schema 在提供给模型前会将它移除：源码注释说明，暴露它可能让调用方绕过 sed 预览对应的确认和 Sandbox 路径。`validateInput()` 主要处理由 Monitor 功能控制的长时间 `sleep` 命令；它不是完整的 Shell 安全分析器。

之后 `checkPermissions()` 委托给 `bashToolHasPermission()`。这一步是第 23 课工具生命周期中的权限阶段；本课聚焦 Bash 自身如何实现该决策。

## 命令分析与权限决策

`bashToolHasPermission()` 优先尝试 tree-sitter 安全解析，并把结果分成三类：

- **`simple`：** 对解析出的命令做语义检查。语义不安全时先保留显式 deny 的效力，否则转为 ask；通过后继续评估后续规则。
- **`too-complex`：** 表示静态分析无法可靠表示命令结构，例如某些展开或控制流。先保留精确权限规则的显式决策，并检查前缀或通配 deny；没有命中时要求用户确认。
- **`parse-unavailable`：** 例如解析器不可用或相关开关关闭时，进入旧解析路径；若旧解析也无法识别语法，则要求确认。

解析可用时，命令结构还会用于运算符、重定向和路径约束检查。若语法或语义不确定，流程不会默认放行；精确 allow 等显式权限仍按规则处理。具体 Shell 语法规则非常多，本课只梳理这些阶段之间的边界。

Sandbox 自动放行只在 Sandbox 已启用、`autoAllowBashIfSandboxed` 开启且当前输入确实会使用 Sandbox 时参与。它仍检查完整命令及复合命令中的显式 deny / ask 规则；未命中时才返回带 Sandbox 条件的 allow。未走这条捷径的调用继续经过精确权限规则、prompt classifier、运算符和路径等检查。

## 从权限结果到隔离执行

实际执行前，`runShellCommand()` 将 `shouldUseSandbox(input)` 的布尔值传给 `exec()`。`shouldUseSandbox()` 在 Sandbox 未启用、命令获准绕过、没有命令或命中排除项时返回 `false`；其他情况下返回 `true`。其中 `dangerouslyDisableSandbox` 只有在策略允许无 Sandbox 命令时才生效。

Sandbox 启用需要同时满足平台受支持、依赖检查通过、当前平台允许且 `sandbox.enabled` 为真。该设置默认读取为 `false`。因此源码并未表示每条 Bash 命令都会被隔离。`excludedCommands` 是用户可配置的便利项，源码明确说明它不构成安全边界；命令权限和用户确认仍是另外一层控制。

`Shell.exec()` 先让 Shell provider 生成命令，再在 `shouldUseSandbox` 为真时调用 `SandboxManager.wrapWithSandbox()`，并准备临时目录。适配器将项目设置转换为运行时配置，最后委托给外部 `@anthropic-ai/sandbox-runtime` 的管理器。仓库内能确认的是配置转换和调用接线；Sandbox runtime 与操作系统实际施加的隔离效果不在当前源码快照中验证。

## 执行结果不是权限结论

进程退出后，`BashTool` 会先用 `interpretCommandResult()` 将退出码映射为命令语义，再把 Sandbox 违规信息标注到输出。比如 `grep` 或 `rg` 退出码为 1 表示没有匹配项，不按执行错误处理；其他未配置特殊语义的命令通常把非零退出码当作错误。这个步骤只解释执行结果，不会把未授权命令变成已授权。

## 静态观察

在仓库根目录执行以下命令，只读取源码：

~~~sh
nl -ba AI/claude-code-analysis-main/src/tools/BashTool/BashTool.tsx | sed -n '227,259p;524,541p;624,720p;826,898p'
nl -ba AI/claude-code-analysis-main/src/tools/BashTool/bashPermissions.ts | sed -n '1270,1359p;1384,1453p;1663,1843p;1845,1973p;1973,2056p;2078,2128p'
nl -ba AI/claude-code-analysis-main/src/tools/BashTool/shouldUseSandbox.ts | sed -n '12,31p;130,153p'
nl -ba AI/claude-code-analysis-main/src/utils/bash/ast.ts | sed -n '375,445p'
nl -ba AI/claude-code-analysis-main/src/utils/Shell.ts | sed -n '171,270p;380,397p'
nl -ba AI/claude-code-analysis-main/src/utils/sandbox/sandbox-adapter.ts | sed -n '172,240p;459,547p;704,792p;927,936p'
nl -ba AI/claude-code-analysis-main/src/tools/BashTool/commandSemantics.ts | sed -n '1,145p'
~~~

## 观察结果

- 输入校验、静态安全分析、权限决定、Sandbox 选择和退出码解释是串联的不同职责，不能用一个“安全检查”概括。
- AST 遇到复杂或不可解析命令时，会采用显式权限规则、确认或旧解析分支；不会仅因解析不确定而默认放行。
- Sandbox 自动放行以当前命令会使用 Sandbox 为前提，并保留显式 deny / ask 规则；`shouldUseSandbox()` 决定执行时是否包裹命令。
- Sandbox 是否启用受设置、平台、依赖和平台列表共同影响；排除命令只影响是否包裹，不取代权限控制。
- 退出码语义用于解释执行结果，与命令在执行前是否获准无关。

## 范围与限制

- 本课只分析当前仓库中 Bash 工具、权限分析、Shell 执行入口和 Sandbox 适配器的静态接线；不逐条整理危险命令模式。
- 结论来自源码快照，未运行 CLI 或操作系统 Sandbox。外部 `@anthropic-ai/sandbox-runtime` 的实现与各平台实际隔离效果没有在此验证。
