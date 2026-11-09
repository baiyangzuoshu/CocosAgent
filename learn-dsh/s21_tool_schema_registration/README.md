# 第 21 课：Tool Schema 与注册

**目标：** 观察类型化工具定义如何注册，再投影成模型请求中可见的 JSON Schema。

## 本课问题

工具实现包含执行函数、输出规则和策略元数据。模型为什么只收到名称、说明和参数结构？参数定义怎样标记必填项？

## 本课增量

本课实现一个小型 `ToolRegistry` 和 `defineTool()`：作者用参数 DSL 声明必填与可选字段；注册表保存带有执行实现和输出声明的定义；`schemas()` 仅复制工具名称、说明和参数 schema，作为模型请求的 `tools`。

```text
defineTool(author DSL)
       │ compile required properties
       ▼
ToolDefinition ── register() ──> ToolRegistry
                                      │ schemas() allowlist projection
                                      ▼
                               GenerateOptions.tools
```

运行后会看到 `search_notes` 的参数 JSON Schema：`query` 在 `required` 数组中，`limit` 保持可选。`timeoutMs`、`output` 和 `execute` 留在运行时定义，不会投影给模型。释放注册句柄后，注册表不再返回该工具。

## 源码对照

- [`packages/core/tools/src/schema.ts`](../../../deepseek-harness/packages/core/tools/src/schema.ts)：`defineTool()` 编译参数 DSL；`projectToolSchema()` 从定义中白名单导出模型可见字段。
- [`packages/core/tools/src/index.ts`](../../../deepseek-harness/packages/core/tools/src/index.ts)：`ToolsService.register()` 把定义放进有作用域的注册表；`schemas()` 返回可见工具的分离 schema。
- [`packages/core/tools/src/contracts.ts`](../../../deepseek-harness/packages/core/tools/src/contracts.ts)：`ToolDefinition` 把模型可见 schema 与执行函数、输出规则、超时元数据放在同一运行时定义中。
- [`packages/core/system-prompt/src/index.ts`](../../../deepseek-harness/packages/core/system-prompt/src/index.ts)：SystemPrompt 收集工具 schema 并按确定顺序形成 `PromptAssembly.tools`。
- [`packages/core/agent-loop/src/agent.ts`](../../../deepseek-harness/packages/core/agent-loop/src/agent.ts)：AgentLoop 把组装出的工具 schema 放入 LLM 请求和 Session request header。
- [`packages/llm/llm/src/types.ts`](../../../deepseek-harness/packages/llm/llm/src/types.ts)：公共 `ToolSchema` 与 `GenerateOptions.tools` 类型。
- [`docs/cookbook/adding-a-tool.zh.md`](../../../deepseek-harness/docs/cookbook/adding-a-tool.zh.md)：工具作者使用 `defineTool()` 与注册表的最小入口。

## 代码结构

```text
s21_tool_schema_registration/
├── README.md
├── deno.json
└── src/
    ├── main.ts
    ├── tool-definition.ts
    ├── tool-registry.ts
    └── types.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

预期结果：输出一个 `tools` 数组，包含 `name`、`description` 和 `parameters`；参数根是 object，`query` 为必填项；schema 不包含执行回调。之后释放句柄，工具数量变为 `0`。

## 观察结果

- 参数 schema 与执行参数是不同阶段：此课只把作者 DSL 编译并提供给模型，不处理模型返回的 arguments。
- `required: true` 表示字段出现在参数根 schema 的 `required` 数组；未设置时字段为可选项。
- Harness 的参数根是隐式开放对象；这个简化实现同样不把 `additionalProperties` 写死为 `false`。
- 注册表的完整定义留有 `execute`、`output` 和本地策略数据；`schemas()` 通过显式投影只导出协议字段，避免把函数或运行时细节发给 Provider。
- Harness 由 `ToolsService` 向 `SystemPrompt` 注册 schema provider，因此工具注册后会自然进入 PromptAssembly 和下一次模型请求。
- 注册返回 disposer。插件卸载时撤销由它拥有的能力；模型侧的 schema 来自当前可见注册集合。

## 简化与边界

- 示例只支持 `string`、`number`、`integer`、`boolean` 和简单枚举；真实 `ParameterSchemaSpec` 还支持数组、对象、`oneOf`、注解和严格的 JSON Schema 子集编译。
- 示例省略 Cordis effect、全局与 Agent 作用域、限制过滤、同名遮蔽、条件启用、`toolSet` 和模型工具顺序配置。
- `execute` 与 `output` 只用于说明它们保留在运行时定义中；本课不调用工具，也不校验模型生成的参数。第 22 课实现参数校验与执行流水线。
- 输出 schema 与渲染回调没有完整校验；展示字段只说明它们不会进入模型 schema。

---

下一课预告：第 22 课「校验与执行流水线」将验证模型 arguments 并受控调用注册实现。
