# 第 20 课：工具注册、Schema 与发现

**目标：** 从 `Tool` 定义追到 REPL 的工具池，再追到 API 请求中的 JSON Schema；理解 Tool Search 如何让模型先看见可发现的工具名称，再按需取得完整 Schema。

## 本课要回答的问题

1. 一个工具对象需要提供哪些信息，`buildTool()` 又补上什么？
2. 内置工具与 MCP 工具怎样组成当前会话的工具池？
3. Zod / MCP JSON Schema 怎样变成 API 工具定义？
4. deferred 工具如何从名称提示进入可调用的完整 Schema？

## 从定义到模型请求

~~~mermaid
flowchart TD
  A[ToolDef: name / schema / prompt / call] --> B[buildTool 填默认行为]
  B --> C[getAllBaseTools 收集可用内置工具]
  C --> D[getTools: 模式 / deny / isEnabled 过滤]
  D --> E[assembleToolPool 合并并去重 MCP 工具]
  E --> F[claude.ts 计算当前请求的 Tool Search gate]
  F --> G{Tool Search 生效?}
  G -- 否 --> H[为全部当前工具生成 API Schema]
  G -- 是 --> I[常驻工具 + ToolSearch + 已发现的 deferred 工具]
  I --> J[ToolSearch 返回 tool_reference 名称]
  J --> K[下一次请求从消息历史提取名称]
  K --> L[发送对应完整 Schema 并可调用]
~~~

这里要分清三层：`getAllBaseTools()` 是内置注册表；`assembleToolPool()` 形成当前上下文可用的工具集合；`claude.ts` 再按模型、Tool Search 状态和对话历史，决定这一条 API 请求实际带哪些 Schema。

## `Tool` 是执行契约，`buildTool()` 不是注册表

`src/Tool.ts` 的 `Tool` 类型把可执行工具描述成一个对象：主名称和可选别名、输入 Schema、说明/Prompt、`call()`，以及启用状态、并发安全、只读/破坏性标记等行为。MCP 可以直接提供 `inputJSONSchema`；常规内置工具通常用 Zod 的 `inputSchema`。`shouldDefer` 与 `alwaysLoad` 则参与后面的 Tool Search 可见性决策。

`ToolDef` 允许省略一部分通用方法，`buildTool(def)` 把定义和默认值合并成完整 `Tool`。例如未覆盖时，并发安全和只读默认为 `false`，`isEnabled()` 默认为 `true`；具体定义仍可覆写这些默认值。真正集中收集内置工具的是 `src/tools.ts` 的 `getAllBaseTools()` 数组，而不是 `buildTool()`。

## 当前工具池：过滤后再与 MCP 合并

`getAllBaseTools()` 返回当前环境可能用到的内置工具，数组中既有固定项，也有按用户类型、环境变量、feature 或平台能力条件加入的项。Tool Search 开关可能性足够时，`ToolSearchTool` 也会先被乐观地加入工具池。

`getTools(permissionContext)` 得到供当前模式使用的内置工具：它会处理 simple/REPL 等模式、去掉被 blanket deny 的工具，并过滤 `isEnabled() === false` 的项。之后 `assembleToolPool()` 把 MCP 工具按 deny 规则过滤，与内置工具合并、按名称去重；重名时内置工具优先。REPL 的 `useMergedTools()` 和 Agent 路径共用这个装配函数。

这一步只决定工具池成员。工具级参数验证、权限询问和实际 `call()` 执行发生在工具调用运行路径，本课不展开这些环节。

## Schema 转换：从输入契约到 API `input_schema`

`queryModelWithStreaming()` 的请求准备阶段会调用 `toolToAPISchema()`。它优先使用工具提供的 `inputJSONSchema`；否则把 `inputSchema` 从 Zod 转成 JSON Schema。工具的 `prompt()` 结果成为 API 定义的 `description`，并可按 feature、工具标记和模型能力附加 `strict` 等可选字段。

`defer_loading` 是逐请求的附加字段，不混进缓存的基础 Schema。当前请求判定工具需要延迟时，`toolToAPISchema()` 才在 API 定义上写入 `defer_loading: true`。关闭实验性 beta 的环境开关会在 Schema 出口剥除这类 beta 字段，避免不支持的网关收到它们。

## Tool Search：先给名称，再按需发现 Schema

`isDeferredTool()` 的规则以 `alwaysLoad` 优先：强制常驻的工具不延迟；普通 MCP 工具默认延迟；内置工具只有设置 `shouldDefer` 才延迟。ToolSearch 本身以及特定必须首轮可用的工具也会保持常驻。判断还受具体特殊工具规则影响，不应简化成“所有 MCP 和所有内置工具都延迟”。

Tool Search 有 `tst`、`tst-auto` 和 `standard` 三种模式。`ENABLE_TOOL_SEARCH` 可以指定模式；`tst-auto` 会按模型窗口和 deferred 工具定义规模判断是否需要延迟。真正发请求时，`isToolSearchEnabled()` 还会检查模型是否支持 `tool_reference`、ToolSearch 是否在允许工具集合中，以及自动阈值。若根本没有 deferred 工具且 MCP 服务没有待连接项，API 层会关闭本次 Tool Search。

启用时，`claude.ts` 保留非 deferred 工具和 ToolSearch，并从消息历史里找出已发现的 deferred 名称；未发现的 deferred 工具不进入该次工具 Schema 列表。ToolSearch 接收 `select:Read,Edit` 一类精确选择，也可按关键词匹配名称、Prompt 和 `searchHint`；默认最多返回 5 个名称。

ToolSearch 的工具结果经 `mapToolResultToToolResultBlockParam()` 编码为 `tool_reference` 内容块。API 会据此在模型上下文中展开对应工具定义；后续请求则由 `extractDiscoveredToolNames()` 从 `tool_result` 里的引用提取名称，`claude.ts` 据此把相应 Schema 加回实际请求。模型在完整 Schema 出现前只有工具名称，没有参数结构，因此还不能调用该 deferred 工具。

## 静态观察

在仓库根目录执行以下命令，只读取源码：

~~~sh
nl -ba AI/claude-code-analysis-main/src/Tool.ts | sed -n '15,21p;343,359p;362,405p;438,455p;697,791p'
nl -ba AI/claude-code-analysis-main/src/tools.ts | sed -n '179,251p;254,267p;271,327p;329,389p'
nl -ba AI/claude-code-analysis-main/src/hooks/useMergedTools.ts | sed -n '8,43p'
nl -ba AI/claude-code-analysis-main/src/utils/api.ts | sed -n '119,265p'
nl -ba AI/claude-code-analysis-main/src/tools/ToolSearchTool/prompt.ts | sed -n '27,51p;53,121p'
nl -ba AI/claude-code-analysis-main/src/tools/ToolSearchTool/ToolSearchTool.ts | sed -n '21,47p;188,303p;304,335p;358,470p'
nl -ba AI/claude-code-analysis-main/src/utils/toolSearch.ts | sed -n '154,198p;227,319p;368,460p;545,586p'
nl -ba AI/claude-code-analysis-main/src/services/api/claude.ts | sed -n '1118,1177p;1231,1257p;1327,1342p'
~~~

## 观察结果

- `Tool` 描述工具契约；`buildTool()` 统一补默认方法；`getAllBaseTools()` 才是内置工具集合的集中入口。
- `assembleToolPool()` 把模式过滤后的内置工具与 MCP 工具汇合；API 请求阶段仍会二次筛出当前模型实际可见的 Schema。
- API Schema 从 Zod 或 MCP 原生 JSON Schema 转换，并在每次请求时叠加 `defer_loading` 等字段。
- Tool Search 的引用保存在消息历史里；下一次 API 请求依据已发现名称带入所需 Schema，使全量工具池不必每轮都以内联完整定义发送。

## 简化与限制

- 本课只追踪工具定义、集合装配、Schema 转换和 Tool Search 发现，不展开权限规则、工具执行和并发调度。
- Tool Search 是否生效受环境配置、模型能力、Provider/网关对 beta 字段的支持以及动态工具集合影响；流程图描述的是启用条件通过后的路径。
- 结论来自当前源码快照静态阅读；未调用模型或验证实际 API Provider 对 `tool_reference` 的运行时处理。
