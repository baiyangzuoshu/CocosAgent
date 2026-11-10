# 第 38 课：Claude Managed Agents Permission Policies 如何控制工具调用？

**目标：** 能区分 always_allow、always_ask 和 auto 的行为，为 Agent 工具集、MCP 工具集及单个工具配置策略，并处理审批事件、自动拒绝和自定义工具边界。

## 本课问题

Agent 请求运行一个工具后，平台何时会直接执行、拒绝或等待确认？更新 Agent 权限后，现有 Session 是否会改变？应用该怎样区分平台托管工具与自己执行的自定义工具？

## 官方资料

- [Permission policies](https://platform.claude.com/docs/en/managed-agents/permission-policies)：策略类型、默认值、单工具覆盖、auto、事件记录和审批流程。
- [Session event stream](https://platform.claude.com/docs/en/managed-agents/events-and-streaming)：接收工具调用、处理 requires_action 与发送确认事件。
- [Managed Agents 安全边界](https://platform.claude.com/docs/en/managed-agents/secure-deployment-risks)：工具权限、提示注入、凭证和沙箱边界。
- [第 20 课：工具调用闭环](../s20_tool_use_loop/README.md)、[第 27 课：工具权限与提示注入](../s27_tool_security_prompt_injection/README.md)、[第 33 课：Workflow Runs](../s33_managed_agents_workflows/README.md)、[第 37 课：Managed Agents Outcomes](../s37_managed_agent_outcomes/README.md)。

核对日期：2026-11-10。Permission Policies 当前为 Beta，使用 managed-agents-2026-04-01 Header；官方页面注明 Managed Agents 不符合 ZDR 和 HIPAA 资格。策略字段、工具名称、评估事件和平台支持会变化，实施前应检查目标平台当前文档。

## 1. 权限策略控制已启用工具的调用时机

Permission Policy 为 Managed Agents 的服务端执行工具设置调用策略，适用于预置 Agent Toolset 与 MCP Toolset。策略不是工具开关：要移除 Agent 的某项能力，应关闭该工具；策略则决定仍然启用的工具如何运行。[Permission policies](https://platform.claude.com/docs/en/managed-agents/permission-policies)

| 策略 | 平台行为 | 适用理解 |
| --- | --- | --- |
| **always_allow** | 自动运行，不等待确认。 | 已授权、适合自动执行的工具。 |
| **always_ask** | 暂停 Session，等待应用或操作者允许/拒绝。 | 必须逐次人工审核的调用。 |
| **auto** | 服务端对每次调用评估，并选择运行、拒绝或等待确认。 | 接受服务端风险判断、并为不确定调用保留确认流程的场景。 |

官方当前默认值需要特别留意：Agent Toolset 默认为 always_allow；MCP Toolset 默认为 always_ask。两者都可显式配置；auto 不会自动成为默认策略。MCP 默认需要确认，有助于避免服务器后来增加的新工具未经审查便执行。[Permission policies](https://platform.claude.com/docs/en/managed-agents/permission-policies)

## 2. 按工具集设默认值，再为关键工具覆盖

策略写在 Agent 的 tools 配置里。工具集的 default_config.permission_policy 设置整个工具集的默认行为；configs 中的单项规则可覆盖某个工具。MCP 覆盖项使用 MCP Server 报告的工具名称；MCP Toolset 的 mcp_server_name 必须与 Agent 的 mcp_servers 配置名称一致。[Permission policies](https://platform.claude.com/docs/en/managed-agents/permission-policies)

~~~yaml
mcp_servers:
  - type: url
    name: github
    url: https://github-mcp.example.com/

tools:
  - type: agent_toolset_20260401
    default_config:
      permission_policy:
        type: auto
    configs:
      - name: bash
        permission_policy:
          type: always_ask
  - type: mcp_toolset
    mcp_server_name: github
    default_config:
      permission_policy:
        type: always_ask
~~~

以上例子将 Agent Toolset 默认交由服务端评估，但 Bash 每次都需要确认；GitHub MCP 调用也需要确认。实际字段名称以 Agent 当前可用工具列表和对应 MCP Server 报告为准。对团队必须审查的动作，直接为对应工具设 always_ask，不要只依赖较宽的工具集默认策略。

更新 Agent 配置会影响之后创建的 Sessions；已经运行的 Sessions 继续使用创建时的工具配置。上线调整后，应确认新任务创建了引用最新 Agent 配置的 Session。[Permission policies](https://platform.claude.com/docs/en/managed-agents/permission-policies)

## 3. 理解 auto 的放行、拒绝和等待

auto 会结合工具、调用参数和当前 Session 内容，逐次作出决定。因此，同一工具的两个调用可能得到不同结果：

| 结果 | 调用发生什么 | Agent / Session 接下来怎样 |
| --- | --- | --- |
| allow | 工具直接运行。 | Agent 收到工具结果并继续。 |
| deny | 高风险调用被拒绝。 | Agent 收到 is_error: true 的错误工具结果；客户端不能覆盖该拒绝。 |
| ask | 服务端无法确定是否可运行，等待审批。 | Session 请求应用或操作者确认后，再继续处理。 |

auto 是自动风险判断，没有人工查看并确认每个放行调用的环节；放行的副作用可能不可撤销。若必须有人在执行前查看操作及参数，应给对应工具设置 always_ask。[Permission policies](https://platform.claude.com/docs/en/managed-agents/permission-policies)

该策略如何看待输入也很关键：user.message 会被视为请求方的意图，可能使服务端放行某些调用；如果应用把不可信终端用户文本直接作为 user.message 转发，这些文本也会影响判断。工具结果、网页、MCP Server 响应和其他 Thread 的消息不会被当作授权指令，但会作为 Session 内容接受评估。对不允许终端用户自行批准的动作，应使用 always_ask，并在应用侧核验真实用户身份和授权范围。[Permission policies](https://platform.claude.com/docs/en/managed-agents/permission-policies)

## 4. 通过事件实现真实的人工确认

always_ask，以及 auto 得到 ask 时，平台会产生工具调用事件并等待确认：

1. 收到 agent.tool_use 或 agent.mcp_tool_use，检查完整工具名、参数与 evaluated_permission: "ask"。
2. Session 可能发出 session.status_idle，其中 stop_reason.type 为 requires_action，阻塞事件 ID 列在 stop_reason.event_ids 中。
3. 应用展示这次实际操作和关键参数，再发送 user.tool_confirmation；每个确认事件以对应的工具调用 ID 作为 tool_use_id，result 设为 allow 或 deny，拒绝时可附 deny_message。
4. 所有阻塞调用得到处理后，Session 恢复运行；获准的调用执行，被拒绝的调用不会执行，Agent 会收到拒绝结果。

只确认 evaluated_permission 为 ask 的调用。若 auto 已给出 deny，服务端不允许客户端用确认事件覆盖；针对非 ask 事件发送确认会被 API 拒绝。不能仅凭 Session idle 就执行确认，必须核对相应事件及实际参数。[Permission policies](https://platform.claude.com/docs/en/managed-agents/permission-policies)

多 Agent Workflow 有一个特别的事件边界：子 Thread 发出的待审批调用会出现在主 Session 事件流；如果 Session 里还有其他工作，Session 可能仍处于 running，不会先发 session.status_idle。应用应按工具调用事件处理审批，而不能只等 idle 状态或 stop_reason.event_ids。[Permission policies](https://platform.claude.com/docs/en/managed-agents/permission-policies)、[Workflow Runs](https://platform.claude.com/docs/en/managed-agents/workflow-runs)

事件中的 evaluated_permission 是 allow、ask 或 deny。大多数事件还带 evaluation.type；auto 评估可能附 reason_code。应用可用这些字段更新审计记录与工作流状态，但应容忍未知的策略类型或原因码。原因码适合机器分支和内部记录，不应直接当作面向终端用户的解释文本。[Permission policies](https://platform.claude.com/docs/en/managed-agents/permission-policies)

## 5. 自定义工具仍由应用负责执行门禁

Managed Agents Permission Policies 不管理应用自己的 Custom Tools。Agent 发出 agent.custom_tool_use 后，应用接收事件、决定是否执行自定义函数，再将 user.custom_tool_result 返回 Session。若 Custom Tool 能付款、发信、改记录或调用生产服务，身份校验、业务授权、参数验证和人工确认都要放在应用的执行代码中；不能因为 Agent 同时启用了 always_ask 或 auto 就假定这些自定义动作受管控。[Permission policies](https://platform.claude.com/docs/en/managed-agents/permission-policies)、[Session event stream](https://platform.claude.com/docs/en/managed-agents/events-and-streaming)

权限策略控制调用前是否运行；凭证权限、网络范围、隔离环境和可访问数据仍有各自控制面。对高风险操作使用最小工具集、最小权限凭证和受限网络，并结合人工确认与事后审计。[Managed Agents 安全边界](https://platform.claude.com/docs/en/managed-agents/secure-deployment-risks)

## 练习：配置代码审查 Agent

团队希望 Agent 可以读取代码库、使用 Bash 运行检查，并通过 GitHub MCP 创建 Issue。检查命令与建 Issue 都需要人工确认；Agent 不应调用未批准的外部 MCP 工具。请设计 Toolset 策略、说明默认值的影响，并写出应用审批事件的关键处理步骤。

**参考答案：** 将 GitHub Server 配置为可信的 MCP Server，并只启用需要的工具；为 Agent Toolset 显式设置 default_config.permission_policy，再为 Bash 配 always_ask。GitHub MCP 默认 always_ask，也可显式写出以便审查配置；不要设为 auto 或 always_allow，除非组织已经接受其自动执行边界。应用收到 agent.tool_use / agent.mcp_tool_use 后核对 evaluated_permission 为 ask，显示命令或 Issue 内容及目标仓库，再将 user.tool_confirmation 关联到准确的 tool_use_id。如果其中一步是 Custom Tool，则该工具调用需由应用自行授权和执行。更改 Agent 后，使用新创建的 Session 验证新策略。

## 本课结论

Managed Agents Permission Policies 为 Agent 与 MCP 工具提供 always_allow、always_ask 和 auto 三种调用时机控制，并可按工具集设默认、按单工具覆盖。应用要区分运行、拒绝和待确认事件；对有人工把关要求的操作使用 always_ask。Custom Tools 由应用自行守住授权与执行边界。

## 范围与时效

- 官方文档核对日期：2026-11-10；Permission Policies 当时为 Beta。
- 默认策略、工具名称、evaluated_permission / evaluation 事件结构及平台支持可能变化；按目标平台最新文档核验。
- 通用工具调用与提示注入设计见第20、27课；Workflow Thread 的停止与完成边界见第33课。
