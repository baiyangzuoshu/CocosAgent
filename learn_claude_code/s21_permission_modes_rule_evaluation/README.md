# 第 21 课：权限模式与规则评估

**目标：** 追踪启动时权限模式如何确定、配置规则如何进入 `ToolPermissionContext`，以及一次工具调用如何得到 `allow`、`deny` 或 `ask`。

## 本课要回答的问题

1. CLI 参数和设置中的 `defaultMode` 如何选出本次会话模式？
2. `allow`、`deny`、`ask` 规则分别来自哪里，如何表示？
3. 规则、工具自身权限检查和模式放行按什么顺序参与决策？
4. `dontAsk`、`bypassPermissions` 与 `auto` 如何改变尚未解决的询问？

## 从启动配置到一次权限决策

~~~mermaid
flowchart TD
  A[危险跳过参数 / --permission-mode / settings.defaultMode] --> B[initialPermissionModeFromCLI]
  B --> C{门禁过滤后首个有效模式}
  C --> D[initializeToolPermissionContext]
  D --> E[磁盘规则 + CLI 规则进入按来源分组的上下文]
  E --> F[工具调用进入 hasPermissionsToUseTool]
  F --> G{整工具 deny 规则}
  G -- 命中 --> X[deny]
  G -- 未命中 --> H{整工具 ask 规则}
  H -- 命中 --> Y[ask；沙箱 Bash 有例外]
  H -- 未命中 --> I[tool.checkPermissions 检查解析后的输入]
  I --> J{工具拒绝 / 强制询问 / 安全检查}
  J -- 有结论 --> Z[保留工具决策]
  J -- 无结论 --> K{bypass 模式有效}
  K -- 是 --> L[allow]
  K -- 否 --> M{整工具 allow 规则}
  M -- 命中 --> L
  M -- 未命中 --> N[保留工具结果；passthrough 转为 ask]
  N --> O{外层模式转换}
  O -- dontAsk --> P[ask 转 deny]
  O -- auto 且功能可用 --> Q[分类器路径]
  O -- 其他 --> R[进入权限处理路径]
~~~

模式描述会话使用哪种权限策略；规则描述某些工具或工具输入的具体 allow / deny / ask 条件。两者共同作用，工具自身的 `checkPermissions()` 也参与最终决策。

## 模式在启动时确定

`src/main.tsx` 先调用 `initialPermissionModeFromCLI()`，再把结果交给 `initializeToolPermissionContext()`。候选顺序是危险跳过参数、`--permission-mode`、设置中的 `permissions.defaultMode`；函数选第一个通过限制的候选，没有候选时回到 `default`。因此 `--dangerously-skip-permissions` 会先于普通 CLI 模式尝试，但组织门禁或设置禁用时会跳过 `bypassPermissions`，继续检查后面的候选。

`PermissionMode.ts` 提供运行时模式列表、显示标题和外部模式转换。`auto` 只在 `TRANSCRIPT_CLASSIFIER` 功能构建中加入运行时列表；外部模式集合不包含 `auto`。远端环境还会拒绝部分来自设置的默认模式。不要把 TypeScript 的联合类型、当前构建可选模式和外部 API 可用模式当作同一集合。

模式本身也不是每个工具都由一处统一硬编码行为：共享权限函数处理通用规则和全局转换，具体工具通过 `checkPermissions()` 实现自己的限制。可从共享代码归纳出以下边界：

| 模式 | 共享流程中的作用 |
| --- | --- |
| `default` | 没有规则或工具检查结论时，`passthrough` 转成 `ask`。 |
| `acceptEdits` | 共享函数没有统一的全局放行分支；具体工具根据当前模式判断。`auto` 路径会用 `acceptEdits` 重新检查一部分工具，以跳过分类器快路径。 |
| `plan` | 切入时保存进入前模式；工具检查仍参与决策。若上下文保留了有效的 bypass 权限，计划模式会满足共享函数中的 bypass 条件。 |
| `bypassPermissions` | 只在前置拒绝、强制询问和安全检查通过后才放行；可用性受设置和组织门禁约束。 |
| `dontAsk` | 把内部流程最终仍需询问的结果转成 `deny`。 |
| `auto` | 仅在分类器功能与门禁可用时处理符合条件的询问；危险 allow 规则可能在进入该模式时暂时移出上下文。 |

计划模式和 `auto` 的转换还有额外状态管理；表格概括共享边界，不代表各个工具的完整权限矩阵。

## 规则来源与表示

规则值由 `PermissionRule` 表达：来源 `source`、行为 `ruleBehavior`（`allow` / `deny` / `ask`）和规则值 `ruleValue`。规则值含工具名，可选地含工具输入匹配内容。解析器把 `Bash(npm install)` 一类字符串拆成工具名和内容；空括号或 `(*)` 解析为整工具规则，并会把若干旧工具名归一到当前名称。

`permissionsLoader.ts` 从已启用的用户、项目、本地设置来源读取规则，并始终包含 `flagSettings` 与 `policySettings`；若托管设置启用 `allowManagedPermissionRulesOnly`，则只加载 `policySettings`。`initializeToolPermissionContext()` 另行解析 `--allowed-tools` 和 `--disallowed-tools`，分别写入 `cliArg` 来源；指定 `baseTools` 基础集合时，还会为集合外的工具生成拒绝规则。随后初始设置通过 `applyPermissionRulesToPermissionContext()` 累加到上下文。保留来源信息，便于解释规则来自哪个设置层。

这里的“来源顺序”和“行为优先级”是两回事。规则上下文按来源保存 allow、deny、ask 列表；工具检查先找匹配的整工具 deny，再检查整工具 ask，然后才检查工具自己的权限逻辑。不能因为某来源有 allow，就推断它能覆盖另一个来源的 deny。

## 一次工具调用如何评估

`hasPermissionsToUseToolInner()` 可按以下顺序阅读：

1. 匹配整工具 deny 规则，命中即拒绝。
2. 匹配整工具 ask 规则，命中即询问；沙箱启用自动放行的 Bash 命令有条件地交给 Bash 自己继续检查。
3. 解析工具输入并调用 `tool.checkPermissions()`。工具明确拒绝时拒绝；强制用户交互、内容级 ask 规则和特定安全检查会保留询问结果。
4. 检查有效的 `bypassPermissions`，或携带 bypass 可用状态的 `plan` 上下文；满足时放行。
5. 检查整工具 allow 规则；再无更高优先级结论时，保留工具自身结果，`passthrough` 才转成 `ask`。

`toolMatchesRule()` 只匹配整工具规则；带 `ruleContent` 的规则留给对应工具的权限检查处理。MCP 工具支持按完整限定名或服务器名匹配。Bash 命令片段、文件路径安全检查等具体匹配算法属于工具专题；本课只画出共享决策边界。

`hasPermissionsToUseTool()` 在内部结果之后还会处理模式转换：`dontAsk` 把遗留的 `ask` 变成拒绝；功能可用时，`auto` 可把可分类的询问交给分类器，但强制交互或某些安全检查仍可要求用户处理。用户如何看到询问、选择允许或保存规则，留到第 22 课。

## 静态观察

在仓库根目录执行以下命令，只读取源码：

~~~sh
nl -ba AI/claude-code-analysis-main/src/types/permissions.ts | sed -n '12,79p;420,455p'
nl -ba AI/claude-code-analysis-main/src/utils/permissions/PermissionMode.ts | sed -n '13,121p'
nl -ba AI/claude-code-analysis-main/src/main.tsx | sed -n '1389,1410p;1747,1755p'
nl -ba AI/claude-code-analysis-main/src/utils/settings/constants.ts | sed -n '7,24p;155,167p'
nl -ba AI/claude-code-analysis-main/src/utils/permissions/permissionsLoader.ts | sed -n '27,43p;85,145p'
nl -ba AI/claude-code-analysis-main/src/utils/permissions/permissionRuleParser.ts | sed -n '18,32p;81,152p'
nl -ba AI/claude-code-analysis-main/src/utils/permissions/permissionSetup.ts | sed -n '597,646p;689,810p;872,991p'
nl -ba AI/claude-code-analysis-main/src/utils/permissions/permissions.ts | sed -n '109,131p;213,302p;1071,1156p;1158,1319p;1408,1471p'
~~~

## 观察结果

- 模式候选在初始化时按 CLI 与设置来源确定；门禁可能移除危险或不可用候选，再选择后续候选或 `default`。
- 规则进入按来源、按行为分类的权限上下文；`Tool(content)` 中的内容匹配由工具权限检查负责。
- 共享决策优先处理 deny 和 ask，再评估工具自身检查与模式放行；`dontAsk` 和 `auto` 在内部结果之后还有各自处理。
- bypass 不是忽略所有规则的总开关：拒绝规则、部分 ask、安全检查和强制交互仍位于放行条件之前。

## 范围与限制

- 本课只覆盖模式选择、规则装载及共享 allow / deny / ask 决策；不展开权限 UI、具体文件确认、Bash 语义和沙箱实现。
- `auto`、bypass 禁用策略、远端模式支持和托管规则限制都受 feature、设置及运行环境影响。
- 结论来自当前源码快照静态阅读；未运行 CLI、发起工具调用或验证不同构建配置下的模式行为。
