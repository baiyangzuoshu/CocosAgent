# 第 37 课：Claude Managed Agents Outcomes 如何把完成条件变成评测循环？

**目标：** 能用明确的 Markdown rubric 定义任务完成标准，发送 `user.define_outcome` 启动 Agent 的制作与评估循环，读懂结果事件、迭代上限与交付物，并说明自动评分和最终验收的差别。

## 本课问题

怎么让 Agent 不只“试着完成”，而是依据可检查的标准产出并修订？`satisfied` 能否证明结果真实、准确且适合业务使用？Agent 运行结束后，应用怎样找到并核验文件交付物？

## 官方资料

- [Define outcomes](https://platform.claude.com/docs/en/managed-agents/define-outcomes)：rubric、`user.define_outcome`、评估事件、结果状态与文件交付。
- [Session event stream](https://platform.claude.com/docs/en/managed-agents/events-and-streaming)：读取事件、跟踪状态、继续引导或中断 Session。
- [Session budgets](https://platform.claude.com/docs/en/managed-agents/budgets)：为 Session 设置费用上限并处理预算暂停。
- [第 26 课：Claude 应用质量评估](../s26_claude_app_evaluation/README.md)：通用评估样本、评分器与复查流程。
- [第 27 课：工具权限与提示注入](../s27_tool_security_prompt_injection/README.md)、[第 32 课：Managed Agents 生命周期](../s32_managed_agents_lifecycle/README.md)、[第 33 课：Workflow Runs](../s33_managed_agents_workflows/README.md)。

核对日期：2026-11-10。Outcomes 当前为 Beta，使用 `managed-agents-2026-04-01`；官方页面注明 Managed Agents 不符合 ZDR 和 HIPAA 资格。字段、迭代限制、支持平台与数据处理条件会更新，实施前应按目标平台复核。

## 1. Outcome 把“做完”写成可评估的目标

普通 `user.message` 让 Agent 处理一次对话任务；Outcome 则要求调用方同时提供预期结果和评分 rubric。Managed Agents 会在 Session 中启动 Agent，并为 rubric 配置 grader；Agent 生成交付物，grader 按标准检查，反馈再交给 Agent 修订。这形成一段应用可跟踪的工作循环。[Define outcomes](https://platform.claude.com/docs/en/managed-agents/define-outcomes)

| 概念 | 判断什么 | 不能单独证明什么 |
| --- | --- | --- |
| Agent 消息或工具事件 | Agent 正在说什么、使用了什么工具。 | 交付物已满足验收标准。 |
| Workflow Run 结束状态 | Workflow 程序是否结束、有哪些 Thread 结果。 | 结果正确或满足业务规则。 |
| Outcome 的 `result` | Grader 根据指定 rubric 对产物的评估结果。 | Rubric 完整、输入事实正确，或业务方已接受交付物。 |

Grader 使用独立的 context window，减少被主 Agent 的实现过程影响；它会返回通过或未通过的标准说明，并把反馈交回 Agent。独立评估上下文有助于减少一种偏差，但 grader 仍然只是在评 rubric。对准确性、合规或高影响场景，应另用确定性检查、领域复核或人工验收。[Define outcomes](https://platform.claude.com/docs/en/managed-agents/define-outcomes)、[第 26 课：Claude 应用质量评估](../s26_claude_app_evaluation/README.md)

## 2. Rubric 要具体到逐项能判定

每个 Outcome 都需要 Markdown rubric。Grader 分别检查各项条件；“内容质量高”“分析完整”这类抽象标准容易造成含糊的评分。优先使用可检查的陈述，例如“报告中每个结论都引用一份来源”“输出文件包含指定的四个栏目”。若难以从零写标准，可以先给 Claude 一个已验收的示例，让它整理出 rubric 草稿，再由负责人修订。[Define outcomes](https://platform.claude.com/docs/en/managed-agents/define-outcomes)

例：

~~~markdown
# 供应商审查报告 rubric

- 输出目录中有 `report.md`，且包含结论、证据、风险和未决问题四个部分。
- 每项风险都引用对应问卷或政策资料，并标注来源位置。
- 资料没有支持的结论标为“无法确认”，不得补写成事实。
- 高风险发现逐项列出影响范围和需要人工确认的问题。
~~~

`description` 说明要产出什么；rubric 说明 grader 怎样判断。两者要一致，避免一处要求摘要、另一处要求完整审计等矛盾，否则评估可能以 `failed` 结束。Rubric 应覆盖关键输出结构、来源依据、业务约束和缺失信息处理，而不必把所有写作偏好都变成门槛。

## 3. 通过 `user.define_outcome` 启动任务

先创建已有 Agent 与 Environment 的 Session，再发送 `user.define_outcome` 事件。该事件一经发送就启动工作，不需要再发送一条 `user.message`。小型 rubric 可内嵌为文本；要跨 Session 复用时，可先上传为文件，再通过 `file_id` 引用。[Define outcomes](https://platform.claude.com/docs/en/managed-agents/define-outcomes)

~~~json
{
  "type": "user.define_outcome",
  "description": "生成供应商审查报告 Markdown 文件",
  "rubric": {
    "type": "text",
    "content": "# 报告 rubric\n- 输出 report.md\n- 每项结论都有来源依据\n- 未被资料支持的结论标为无法确认"
  },
  "max_iterations": 4
}
~~~

`max_iterations` 可选，官方文档当前列出的默认值为 3、上限为 20。它是 Agent 对产物修订与评分的循环上限；设置上限不代表一定能通过，也不替代 Session 的费用预算。每轮评分事件会报告 usage，可以和 [Session budget](https://platform.claude.com/docs/en/managed-agents/budgets) 配合，避免无界迭代。

## 4. 根据结果事件处理修订和结束

事件流会为 Outcome 增加 `span.outcome_evaluation_*` 事件。`start` 表示 grader 开始评某一轮，`ongoing` 是评估仍在运行的心跳；该事件不会公开 grader 的内部推理。`end` 包含本轮结果、说明、iteration 和 usage。

| `span.outcome_evaluation_end.result` | 后续行为 | 应用要做什么 |
| --- | --- | --- |
| `needs_revision` | Agent 开始下一轮修订。 | 继续跟踪，不要先取最终结论。 |
| `satisfied` | Session 转为 idle。 | 检查 grader 说明和实际交付物，按业务验收规则决定是否采用。 |
| `max_iterations_reached` | Agent 还有一轮最终确认，然后 Session 转为 idle；不会再评分。 | 明确记为达到上限，不要当作满足 rubric。 |
| `failed` | Session 转为 idle；例如 rubric 与交付物不适用或互相矛盾。 | 修订目标或 rubric 后再启动合适的任务。 |
| `interrupted` | 活跃 Outcome 被中断。 | 当作尚未完成的工作处理，并决定是否重启或转人工。 |

应用可以监听 Event Stream 上的 `span.outcome_evaluation_end`，也可以读取 Session 对象的 `outcome_evaluations[].result`；评估完成前可能看到 `pending`、`running` 或 `evaluating`。发送 `user.message` 可以在运行中补充方向；发送 `user.interrupt` 会中断当前 Outcome 并以 `interrupted` 结束该评估流程。评估结束后，可以继续对话或开始新的 Outcome。[Define outcomes](https://platform.claude.com/docs/en/managed-agents/define-outcomes)、[Session event stream](https://platform.claude.com/docs/en/managed-agents/events-and-streaming)

不要把 Session 进入 idle 和 Outcome 成功混为一谈：达到迭代上限、评估失败、中断也会让任务停下来。应用应结合 Outcome 结果和 Session 的停止原因判断当前工作到了哪一步。

## 5. 找到交付物，再做自己的验收

Outcome Agent 把输出文件写到 Session 沙箱的 `/mnt/session/outputs/`。应用可以用 Files API 按 `scope_id=session.id` 列出文件，再按文件 ID 下载。文件可能在 Agent 写入后的几秒才出现在列表里；若 Session 刚 idle 就未找到预期文件，可稍后重试列出。按 Session 过滤 Files API 时需使用 Managed Agents Beta Header。[Define outcomes](https://platform.claude.com/docs/en/managed-agents/define-outcomes)

一个稳健的交付流程是：

1. 等到终态 `satisfied`，读取 grader 的逐项说明。
2. 查询该 Session 的输出文件；如刚完成时列表尚未更新，短暂等待后重试。
3. 下载文件并检查内容、来源、结构和实际可用性。
4. 对高风险或重要交付物执行外部事实检查、代码/格式校验或人工审批。
5. 按 Session 的保留和删除策略保存必要记录，并清理不再需要的会话数据。

Outcome 的 `satisfied` 意味着 grader 按 rubric 认为产物达标；它不会自动证明源数据无误、事实查证完整、授权动作合规或业务方已签收。最终验收标准应由调用 Outcome 的应用定义，尤其不能让自动评分取代本应由人批准的发布、付款或生产环境修改。

## 6. 在启动迭代前配置审批和费用边界

`user.define_outcome` 会立即启动 Agent。因此如果任务涉及对外发布、修改共享数据或其他高影响副作用，应在发送事件前准备好工具权限与审批流程。Outcome 只定义“交付物是什么、怎样评分”，不会自动要求人工批准工具调用，也不会增加可用工具权限。工具是否可用及调用是否需要确认，仍由 Agent 配置、Permission Policy、环境和应用自身的授权流程控制。[Define outcomes](https://platform.claude.com/docs/en/managed-agents/define-outcomes)、[Permission policies](https://platform.claude.com/docs/en/managed-agents/permission-policies)

按风险将 rubric 和权限分开设计：rubric 验证产物；权限策略约束 Agent 执行期间可做的操作。对必须人工审核的工具，设置 `always_ask` 等合适策略；`auto` 策略并不等于人工审批点。会话预算再限制总费用，`max_iterations` 则限制最多修订多少轮。[Session budgets](https://platform.claude.com/docs/en/managed-agents/budgets)、[Permission policies](https://platform.claude.com/docs/en/managed-agents/permission-policies)

## 练习：生成一份可复查的研究简报

应用要求 Claude 从提供的几篇政策与研究页面生成一份 Markdown 简报，供分析师复查。请拟定 Outcome `description` 和 rubric，说明用哪些事件判断评分结束，以及如何取得和验收文件。简报只要达到格式标准就能自动发布吗？

**参考答案：** `description` 写明目标文件和用途；rubric 至少要求输出指定栏目、每个主要判断附官方来源、对来源未支持的信息明确标记、区分来源事实与分析推断。发送 `user.define_outcome` 后监听 `span.outcome_evaluation_end`，对 `needs_revision` 继续等待，对 `max_iterations_reached`、`failed` 和 `interrupted` 分别报告未达标或未完成；收到 `satisfied` 后查询 Session 范围的 Files API 并下载简报。再抽查来源是否真的支持结论，并由分析师复核。格式或自动 grader 通过不代表可以自动发布；若发布属于受控副作用，仍需单独的权限策略和人工确认。

## 本课结论

Managed Agents Outcomes 将目标描述和 Markdown rubric 变成可跟踪的 Agent 修订—Grader 反馈循环。应用要正确区分各类结束结果，限制费用与迭代，并取得真实交付文件。Grader 的 `satisfied` 是 rubric 评估信号，不是业务验收凭证；可靠交付仍需要针对风险设计独立的事实核查和审批。

## 范围与时效

- 官方文档核对日期：2026-11-10；Outcomes 当时为 Beta。
- `max_iterations` 的默认值与上限、事件字段、文件可见延迟和数据处理条款可能变化；上线前按目标平台重新核对。
- 通用评估设计见第26课；Workflow Run 完成状态与预算见第33课；工具授权见第27课。
