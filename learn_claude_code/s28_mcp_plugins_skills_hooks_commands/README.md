# 第 28 课：MCP、插件、Skills、Hooks 与斜杠命令

**目标：** 沿扩展装载和会话调用路径，分清 MCP、Plugin、Skill、Hook 与斜杠命令各自存放什么、进入哪个注册表，以及由谁消费。

## 本课要回答的问题

1. MCP 连接后，工具、提示词和资源分别进入哪些状态或调用路径？
2. 插件本身是一个运行工具，还是把组件分发到多个系统的启用单元？
3. Skill 如何成为用户可输入或模型可调用的提示内容？它和 MCP prompt 有何区别？
4. 斜杠命令如何区分本地处理器与提示型命令？
5. Hook 怎样从事件配置走到匹配执行，又如何和 Skill、Plugin 发生关系？

## 一张图看懂扩展路径

~~~mermaid
flowchart TD
  PL[Plugin：已启用的扩展包] --> PC[commands / skills / agents]
  PL --> PH[hooksConfig]
  PL --> PM[mcpServers]
  PC --> CR[命令与 Skill 加载器]
  PH --> HR[Plugin Hook 注册器]
  PM --> MC[MCP 配置合并与连接]

  MC --> MT[tools/list → MCP Tool]
  MC --> MP[prompts/list → MCP Prompt Command]
  MC --> MR[MCP resources]
  MT --> TP[REPL / Agent 工具池]
  MP --> MS[AppState.mcp.commands]
  MR -->|MCP_SKILLS 开启时另行发现| MK[MCP Skill Command]
  MK --> MS
  MS -->|仅 MCP Skill 条目可进入| ST[SkillTool]

  SK[Skill Markdown + frontmatter] --> CR
  CR --> CM[getCommands：统一 Command 列表]
  U[用户输入 /name args] --> SC[processSlashCommand]
  SC -->|type: local| LC[加载本地处理器]
  SC -->|type: prompt| PE[展开 getPromptForCommand]
  ST --> PE
  PE --> Q[进入当前会话或 fork Agent]

  EV[工具、会话等生命周期事件] --> HM[按事件字段匹配 Hook]
  HR --> HM
  PE -->|Skill frontmatter hooks| HM
  HM -->|信任检查、执行与结果处理| OUT[阻断、更新输入或追加上下文等]
~~~

## 先区分五个名词

| 名称 | 在源码中的角色 | 主要进入路径 |
| --- | --- | --- |
| MCP | 外部服务协议连接；可提供工具、prompts 和 resources | MCP 配置 → 连接客户端 → 分别转换并交给工具池或命令状态 |
| Plugin | 可启用/禁用的扩展包及其组件集合 | 插件加载器读取包，再由命令、Skill、Agent、Hook、MCP 等专用加载器消费组件 |
| Skill | 带元数据的提示内容，可附带工具限制、执行上下文和 Hook | Markdown/frontmatter → `PromptCommand` → 斜杠调用或 `SkillTool` |
| Hook | 绑定生命周期事件和匹配条件的处理器 | 事件入口 → 配置匹配 → 信任与执行检查 → 汇总 Hook 结果 |
| 斜杠命令 | 面向用户的 `/name args` 输入语法，也是提示型命令的一种调用入口 | 解析名称 → 命令列表查找 → 按 `type` 分发到本地处理器或提示展开 |

这些对象不是同一层的“插件系统”：Plugin 是扩展包，MCP 是外部服务协议，Skill 提供提示内容，Hook 监听事件，斜杠命令负责输入路由。它们可以连接，例如 Plugin 可以携带 Skills、Hook 配置和 MCP server 配置。

## MCP：同一连接的能力分开落位

`getClaudeCodeMcpConfigs()` 汇总 Claude Code 配置范围，并纳入启用插件的 MCP server；`getAllMcpConfigs()` 再处理可用的 claude.ai 配置与策略过滤。`useManageMCPConnections` 取得配置后启动连接，具体连接结果由 `getMcpToolsCommandsAndResources()` 分发。

客户端对 MCP 能力做了不同的内部适配：

- `fetchToolsForClient()` 请求 `tools/list`，把服务端工具包装为 Claude Code 的 `Tool`，附带命名空间和 `mcpInfo` 等来源信息。`useMergedTools()` 再将 MCP 工具汇入 REPL/Agent 工具池。
- `fetchCommandsForClient()` 请求 `prompts/list`，把 MCP prompt 转成 `type: 'prompt'`、`source: 'mcp'` 的 `Command`。它们和工具不是同一种对象。
- resources 通过 MCP 连接回调单独报告，不会因为存在于同一连接就自动变成斜杠命令。
- MCP Skills 是另一条路径：连接器在启用 `MCP_SKILLS` 且服务端支持 resources 时调用 `fetchMcpSkillsForClient()`，并把结果与 prompts 一起写入连接状态的 `commands`。当前快照缺少动态加载目标 `src/skills/mcpSkills.ts`，因此可以确认调用条件与分流，不能从本地文件还原资源如何被解析成 Skill。

MCP prompt 与 MCP Skill 也不能直接画等号。源码以 `loadedFrom === 'mcp'` 区分 MCP Skill；普通 MCP prompt 使用 `isMcp` 标记，而不会因此自动成为 `SkillTool` 可发现的 Skill。`getMcpSkillCommands()` 还要求 `MCP_SKILLS` 开启且 model invocation 未被禁用。

## Plugin：一个包，多条组件装载路径

`LoadedPlugin` 记录插件目录、启用状态以及 commands、agents、skills、hooks、MCP servers、LSP servers、output styles 等组件路径或配置。`createPluginFromPath()` 读取清单并探测可选目录；`assemblePluginLoadResult()` 合并 marketplace、会话级和内置插件来源。

加载器不会把所有组件交给同一个插件运行器。启用插件的命令和 Skill 分别由 `getPluginCommands()`、`getPluginSkills()` 加入命令系统；`loadPluginHooks()` 把 `hooksConfig` 转为匹配器并注册；MCP 集成则把插件的 `mcpServers` 解析、加作用域后交给 MCP 配置路径。换句话说，Plugin 是分发和启用边界，其组件进入不同的执行者。

内置 Plugin 和 bundled Skill 也有区别：bundled Skill 可作为打包提示命令注册；内置 Plugin 有插件启用状态和多组件能力，可通过插件系统管理。不要只因两者都随 CLI 一起分发就合并成一种对象。

## Skill 与斜杠命令：共享命令接口，内容和执行方式不同

`loadSkillsDir.ts` 解析 Skill 的 frontmatter，包括 `description`、`allowed-tools`、`user-invocable`、`disable-model-invocation`、`context`、`agent`、`paths` 与 `hooks` 等字段。`createSkillCommand()` 将 Markdown 和元数据包装为 `type: 'prompt'` 的命令；调用 `getPromptForCommand()` 时才替换参数并产生提示内容。设置 `context: fork` 时，`SkillTool` 走 fork Agent 路径；否则走 `processPromptSlashCommand()` 的提示展开路径。

`getCommands()` 把目录 Skill、插件 Skill、bundled Skill、内置插件 Skill、工作流、插件命令和内置命令组合成当前命令列表，并在返回前过滤可用性与启用条件。这个列表既供斜杠输入查找，也供 Skill 工具筛选提示型命令。两种入口可以复用内容，但执行方式不必相同。

`processSlashCommand()` 先解析 `/name args` 并检查命令存在；`PromptCommand` 由 `getMessagesForPromptSlashCommand()` 获取提示内容，Skill 的 Hook frontmatter 也在此处按策略注册；本地命令则有单独的 `LocalCommandCall` 接口，动态加载实现函数。因此“斜杠命令”是输入及分派接口，不等于 Skill，也不保证所有命令都是提示词。

## Hook：由生命周期事件驱动

`getMatchingHooks()` 根据 Hook 事件选取匹配字段，例如 `PreToolUse` / `PostToolUse` 匹配工具名、`SessionStart` 匹配启动来源、`SubagentStart` 匹配 Agent 类型。之后 `executeHooks()` 检查全局禁用与交互模式的工作区信任，再查出匹配项并执行。

工具、用户提示和会话启动各有事件入口，例如 `executePreToolHooks()`、`executePostToolHooks()`、`executeUserPromptSubmitHooks()`、`executeSessionStartHooks()`。它们在对应生命周期边界构造 Hook 输入，并交由共用执行器；具体结果解析可影响工具流程、更新输入或提供额外上下文。这里讲的是代表性入口，不是全部 Hook 事件目录。

Hook 可以来自设置、启用插件或 Skill frontmatter。插件 Hook 从启用插件的 `hooksConfig` 注册；Skill Hook 则在提示型 Skill 被处理时，按来源策略注册到当前 session。`once: true` 的 Skill Hook 在成功后移除。注册时机和来源策略很重要：Hooks 不是一条用户输入命令，而是由运行时事件触发。

## 静态观察

以下命令只读取源码，可用于核对本课调用链：

~~~sh
nl -ba engine/claude-code-analysis-main/src/commands.ts | sed -n '353,398p;445,517p;541,607p'
nl -ba engine/claude-code-analysis-main/src/types/command.ts | sed -n '25,78p'
nl -ba engine/claude-code-analysis-main/src/utils/processUserInput/processSlashCommand.tsx | sed -n '309,340p;817,880p'
nl -ba engine/claude-code-analysis-main/src/services/mcp/config.ts | sed -n '1071,1145p;1258,1290p'
nl -ba engine/claude-code-analysis-main/src/services/mcp/client.ts | sed -n '1743,1796p;2033,2080p;2140,2190p;2226,2260p'
nl -ba engine/claude-code-analysis-main/src/services/mcp/utils.ts | sed -n '44,94p'
nl -ba engine/claude-code-analysis-main/src/skills/mcpSkillBuilders.ts | sed -n '6,43p'
test -f engine/claude-code-analysis-main/src/skills/mcpSkills.ts || echo 'mcpSkills.ts is absent from this snapshot'
nl -ba engine/claude-code-analysis-main/src/hooks/useMergedTools.ts | sed -n '20,40p'
nl -ba engine/claude-code-analysis-main/src/skills/loadSkillsDir.ts | sed -n '185,264p;270,365p;638,660p'
nl -ba engine/claude-code-analysis-main/src/tools/SkillTool/SkillTool.ts | sed -n '81,94p;621,646p'
nl -ba engine/claude-code-analysis-main/src/plugins/builtinPlugins.ts | sed -n '1,25p;57,120p'
nl -ba engine/claude-code-analysis-main/src/types/plugin.ts | sed -n '48,78p'
nl -ba engine/claude-code-analysis-main/src/utils/plugins/pluginLoader.ts | sed -n '1348,1391p;3096,3108p;3137,3182p'
nl -ba engine/claude-code-analysis-main/src/utils/plugins/loadPluginCommands.ts | sed -n '414,435p;840,874p'
nl -ba engine/claude-code-analysis-main/src/utils/plugins/loadPluginHooks.ts | sed -n '91,155p'
nl -ba engine/claude-code-analysis-main/src/utils/plugins/mcpPluginIntegration.ts | sed -n '366,429p;589,634p'
nl -ba engine/claude-code-analysis-main/src/utils/hooks.ts | sed -n '1603,1645p;1952,2018p;3394,3477p;3826,3892p;518,555p;595,625p'
nl -ba engine/claude-code-analysis-main/src/utils/hooks/registerSkillHooks.ts | sed -n '8,64p'
~~~

## 观察结果

- MCP 的连接结果被拆成不同类型：工具进入工具池，prompt 转为命令对象，resources 通过单独路径提供。
- MCP Skill 使用单独的资源发现路径；当前源码快照不包含动态加载目标，发现实现的细节因此不可核验。
- Plugin 不直接代表一个可执行工具；它以启用状态和组件配置把能力分发给独立加载器。
- Skill 是携带 frontmatter 的提示型命令；斜杠命令是统一输入路由，其中还包含本地处理器。
- Hook 由生命周期事件触发，匹配条件、工作区信任、来源策略和 Skill/Plugin 注册时机共同决定执行边界。

## 范围与限制

- 本课覆盖 MCP 连接结果的代表性适配、插件组件分流、Skill/斜杠命令调用和 Hook 匹配路径；不逐项解释所有 transport、frontmatter 字段、插件来源、MCP resource 操作或 Hook 事件。
- 结论来自当前源码快照的静态阅读；未连接 MCP 服务，未安装或运行 Plugin/Skill，未执行任何 Hook，也未在 CLI 中验收斜杠命令。
