# 第 24 课：工具调用审批

**目标：**
在工具执行前插入一次人工或机器决策，批准后继续执行，拒绝后结束这次调用。

## 本课问题

工具参数已经校验、调用也已经进入执行流水线。遇到敏感操作时，Harness
怎样暂停调用等待决定？批准和拒绝分别会走到哪里？审批记录会不会进入模型上下文？

## 本课增量

在第 23 课闭环基础上，本课聚焦工具的 pre-execute 门禁：先记录
`tool/call`，然后运行 `tools/pre-execute` 策略。策略返回 `ask`
时，`ApprovalService` 为本次调用创建一个审批请求，并将请求与决定写入 Session
审计日志。只有 `allowed-once`
会继续通过单调守卫并调用工具函数；`rejected`、`cancelled`、`unavailable`
都会拒绝执行。

```text
tool/call
    │
    ▼
pre-execute: ask ──► approval/asked ──► answerer
                                          │
                        allowed-once ────┤──► guards ──► tool body
                        rejected 等 ─────┘                (跳过)
                                                           │
                              tool/result ◄────────────────┘
```

示例连续调用两次
`write_note`：第一次批准，第二次拒绝。第二次会产生新的审批请求，说明
`allowed-once` 不会记成长期授权。即使调用被拒绝，仍会记录一个 `isError: true`
的工具结果，与原始 `tool/call` 配对。

## 源码对照

- [`packages/core/tools/src/batch.ts`](../../../deepseek-harness/packages/core/tools/src/batch.ts)：在准备和执行前追加
  `tool/call`；结果结算时追加 `tool/result`，并用 `sourceEventSeqs`
  指向调用事件。
- [`packages/core/tools/src/pipeline.ts`](../../../deepseek-harness/packages/core/tools/src/pipeline.ts)：`prepare()`
  执行 `tools/pre-execute`，遇到 `ask` 后调用审批 seam；只有批准后才检查 guards
  和返回 dispatch。
- [`packages/core/tools/src/contracts.ts`](../../../deepseek-harness/packages/core/tools/src/contracts.ts)：定义
  `allow`、`deny`、`cancel`、`ask` 四种 pre-tool 决策。
- [`packages/interaction/user-approval/src/index.ts`](../../../deepseek-harness/packages/interaction/user-approval/src/index.ts)：`ApprovalService.request()`
  追加成对审计事件，再分发给应答者。
- [`packages/interaction/user-approval/src/types.ts`](../../../deepseek-harness/packages/interaction/user-approval/src/types.ts)：审批
  outcome 只有
  `allowed-once`、`rejected`、`cancelled`、`unavailable`；只有第一项是授权。
- [`packages/interaction/user-approval/README.zh.md`](../../../deepseek-harness/packages/interaction/user-approval/README.zh.md)：解释按会话
  `ask`／`never` 策略、应答者组合和一次性授权。
- [`docs/subsystems/approval.zh.md`](../../../deepseek-harness/docs/subsystems/approval.zh.md)：共享请求、结果和审计语义。
- [`docs/tool-execution-pipeline.zh.md`](../../../deepseek-harness/docs/tool-execution-pipeline.zh.md)：查看
  `tool/call`、审批、guards、执行与结果结算的完整顺序。

## 代码结构

```text
s24_tool_call_approval/
├── README.md
├── deno.json
└── src/
    ├── approval-service.ts
    ├── main.ts
    ├── session-log.ts
    ├── tool-pipeline.ts
    └── types.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

预期观察：

- `call-1` 经过审批、guard 后调用工具函数，返回成功结果。
- `call-2` 得到拒绝结果；执行轨迹中没有它的 guard 和工具函数。
- 工具函数只调用一次。
- Session 中每个审批请求都有相同审批 id 的 `approval/asked` 和
  `approval/decided`；审批请求带 `toolName`、`callId`
  和原因，不重复携带工具参数。
- `approval/*` 是审计事件；面向模型的 `tool/result` 仍包含成功或拒绝结果。

## 关键观察

- 批次先记
  `tool/call`，后询问审批，因此界面可以把提示关联到已经呈现的确切调用。`callId`
  标识工具调用；另一个审批 id 配对 `approval/asked` 与
  `approval/decided`，两者不可互换。
- 审批服务只决定是否能继续；`allowed-once` 之后仍要经过
  guards。审批不是对后续策略守卫的绕过。
- 每次 `ask`
  都重新询问。服务不保存长期授权；同一工具下一次调用不会因为上一次批准而自动放行。
- 工具拒绝会结算为模型可见的错误工具结果，但只结束这次调用，不必然结束 Agent
  的整个 turn；循环可以把结果交给模型决定下一步。
- 审计事件不进入模型
  transcript。模型看到的是消费方产生的工具结果，而不是人工审批 UI
  或审批审计细节。
- 真实实现缺少应答者时以拒绝方式关闭；无人值守的 `never`
  策略会在交互分发前拒绝，不尝试提示用户。

## 简化与边界

- 示例固定让 pre-execute 策略返回 `ask`，不实现完整 waterfall
  插件组合，也不实现每个 Session 的 `ask`／`never` 策略配置。
- 一个内存 answerer 按预设顺序返回结果，没有 UI、ACP、多个 answerer
  的委派或异步用户等待。
- `write_note` 只把记录放进进程内数组，不创建或修改磁盘文件。
- Session
  只建模本课需要的四种事件和文本工具结果；审批审计配对失败、持久化恢复与开放
  turn 检查都省略。
- 拒绝、取消和不可用在本示例中都简化成错误工具结果。真实流水线区分调用取消的
  canonical abort 结果；如果原调用 signal 已取消，请求也会被撤回。
- 示例不重复第 22 课的 schema 校验、参数快照和工具执行器，也不重跑第 23 课的完整
  Agent/LLM turn。

---

下一课：[第 25 课「Shell 执行能力」](../s25_shell_subprocess/README.md)
会让相同的 Shell 消费者分别使用本地与沙箱执行 Provider。
