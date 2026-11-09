# 第 22 课：校验与执行流水线

**目标：** 让工具调用在参数符合 schema 时进入实现；拒绝无效参数，并把工具异常、输出不合约和超时规范化为工具结果。

## 本课问题

模型给出的 `arguments` 是外部输入。如何确保缺少必填字段或类型错误时工具函数不会运行？有效调用完成后，结果如何成为规范值？耗时工具的超时如何通过协作式取消结算？

## 本课增量

本课沿用第 21 课的 `defineTool()` 与注册表，补上三个边界：定义包装器按输入 schema 校验 arguments；执行流水线快照并冻结调用参数，运行工具后校验输出 schema；声明 `timeoutMs` 的工具由简化 deadline wrapper 通过 `AbortSignal` 协作取消。

```text
ToolCall(name, arguments)
        │ registry lookup + JSON snapshot
        ▼
 timeout-policy deadline ──> defineTool.execute
        │                           │ validate arguments
        │                           ▼
        │                       user execute()
        │                           │ canonical value
        └── timeout result <── output schema + render
                                    │
                                    ▼
                            ToolExecutionResult
                         isError=false / isError=true
```

示例先发送缺少 `query` 和 `query` 类型错误的调用，两者均返回 `INVALID_ARGS`，搜索函数调用数仍为零；随后有效调用返回结果。另一个慢工具声明超时，观察到 signal 后停止工作，流水线才结算 `TOOL_TIMEOUT`。

## 源码对照

- [`packages/core/tools/src/schema.ts`](../../../deepseek-harness/packages/core/tools/src/schema.ts)：`defineTool()` 在调用用户函数前校验模型参数，并为失败抛出 `ToolArgsError`。
- [`packages/core/tools/src/json-schema.ts`](../../../deepseek-harness/packages/core/tools/src/json-schema.ts)：JSON Schema 校验器产生带路径的违规信息。
- [`packages/core/tools/src/pipeline.ts`](../../../deepseek-harness/packages/core/tools/src/pipeline.ts)：快照与冻结参数、准备调用、进入工具函数、规范化错误、验证规范输出值。
- [`packages/core/tools/src/index.ts`](../../../deepseek-harness/packages/core/tools/src/index.ts)：`ctx.tools.execute()` 将原始批次交给当前作用域的执行器。
- [`packages/guard/timeout-policy/src/index.ts`](../../../deepseek-harness/packages/guard/timeout-policy/src/index.ts)：在 `tools/execute` 外围设置 deadline；观察到该策略自己的取消后才把结束结果映射为 `TOOL_TIMEOUT`。
- [`docs/tool-execution-pipeline.zh.md`](../../../deepseek-harness/docs/tool-execution-pipeline.zh.md)：展示 pre-execute、单调 guard、execute wrapper、工具体、结果规范化和持久化的相对位置。
- [`docs/cookbook/adding-a-tool.zh.md`](../../../deepseek-harness/docs/cookbook/adding-a-tool.zh.md)：定义工具的输入参数、规范输出和 `exec.signal` 合同。

## 代码结构

```text
s22_tool_validation_execution/
├── README.md
├── deno.json
└── src/
    ├── main.ts
    ├── schema.ts
    ├── tool-pipeline.ts
    ├── tool-registry.ts
    └── types.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

预期结果：两种无效输入都得到 `isError: true` 且不会增加搜索函数调用数；有效输入得到 `isError: false`、规范值和渲染内容。慢工具收到 signal 后收尾，结果标为 `TOOL_TIMEOUT`。

## 观察结果

- 模型可见 JSON Schema 只是提示；运行时仍逐次验证实际 arguments。第 21 课里的 `required` 与类型约束现在成为执行边界。
- 无效参数被 `defineTool` 的 execute 包装器拒绝，用户实现不会被调用。执行器将异常规范化成普通工具错误结果，工具失败不会直接抛成 AgentLoop 的 turn error。
- 参数先脱离调用方对象并冻结，策略与工具实现读取同一份输入；工具不能改写已记录的调用参数。
- 成功返回值也要匹配 `output.schema`，再经 `output.render()` 转换成模型可见 content。规范值与展示文本是不同字段。
- timeout-policy 包装 `tools/execute` 并中止派生 signal。它不会硬杀 JavaScript 函数；工具需要观察 signal 并收尾，包装层等下游安静后才结算超时结果。
- 本课只使用一个小型执行器。真实工具批次还经过 `tools/pre-execute` 和 monotonic guards；审批将在第 24 课单独学习。

## 简化与边界

- 参数校验只覆盖少量 JSON Schema 类型、required、enum、数组项目和对象属性；Harness 支持完整的受限 schema 子集、`oneOf`、嵌套结构与更细错误。
- 本地 `ToolRegistry` 没有 Cordis scopes、条件工具、step admission、原生/PTC 执行器或工具批次并发调度。
- 工具结果只保留 `value`、文本 content、错误代码与消息；没有结构化 `ToolErrorInfo`、Session `tool/call` / `tool/result`、UI 呈现或附加上下文。
- 超时示例由 `ToolExecutionPipeline` 内部计时器模拟 `timeout-policy` 的外围 wrapper；没有复刻 deadline 分类、信号融合或多个 wrapper 的注册顺序。
- 示例调用的 JSON 快照基于 `JSON.stringify()`；Harness 使用 lossless JSON 边界，以拒绝循环、BigInt 等不能无损存入 Session 的值。

---

下一课预告：第 23 课会把模型发出的 Tool Call、工具结果和下一次模型请求接成一个完整回合。
