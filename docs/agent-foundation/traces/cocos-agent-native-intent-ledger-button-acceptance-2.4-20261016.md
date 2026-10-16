# Creator 2.4.15 意图、账本与 Button 改名验收记录（2026-10-16）

## 验收环境

- Creator：2.4.15。
- 隔离工程：`/private/tmp/CocosAgentNativeAcceptance-20261016`。
- 面板显示工程 `2.4.15NewProject · Creator 2.4.15`，当前场景 `helloworld`。
- AgentAcceptanceSprite：路径 `helloworld/Canvas/AgentAcceptanceSprite`，UUID `596pYOww9MqobiatZyhu6v`，名称 `AgentAcceptanceSprite`，位置 `(-150,180)`，缩放 `(0.5,0.5)`；含一个启用的 `cc.Sprite`，无子节点。
- 所有下列操作都从 Creator CocosAgent 面板发起。工程没有执行 Button 改名写入；磁盘 `.fire` 仍保存 `AgentAcceptanceSprite`。

## 已完成的面板回归

### 只解释，不写入

请求：“请只解释：在 Cocos Creator 2.4.15 中，如何创建一个 UI Button 节点并设置其 Label？不要调用工具、不要修改工程，也不要创建节点。请说明操作步骤和关键属性。”

结果：Ask 返回 Creator 2.4.15 的 Button/Label 创建说明；仅执行实例与能力目录只读预检，没有读取工程内容或创建节点，也没有写入回执。

- runId：`6c7ab244-768a-481e-a14a-a38a7d7aa477`。
- trace：`~/.local/state/CocosAgent/agent-runs/2026-10-16T12-24-15-025Z-0e1dfefa.jsonl`。

### 指定账本 ID 读取

请求读取 `operationId=7c1a4f52-9d3b-4e8a-b6c1-2f5e8d0a41b7`，不写入、不补偿、不重放。

结果：Creator 面板调用 `cocos_2x_operation_get`，回执 ID 与请求 ID 完全一致。回执 capability/command 为 `scene.node.patch`，outcome 为 `completed`；`capability`、`preflight`、`editor`、`disk`、`preview` 均为 `passed`，`recovery` 为 `pending`。账本描述的是先前的一像素位置操作 `x: -150→-149`，不是本次 Button 任务；该旧记录未在本次任务中执行。

- runId：`df2d3d98-05c4-4103-95b4-1952910b719f`。
- trace：`~/.local/state/CocosAgent/agent-runs/2026-10-16T12-25-24-498Z-87dec101.jsonl`。

### 不匹配回执拒绝

负向请求目标为 `7c1a4f52-9d3b-4e8a-b6c1-2f5e8d0a41b7`，并故意要求本轮实际调用改读 `b3d0f4ac-6a1e-4f2b-9c77-8e5a1d20c9f6`。

结果：Creator 面板读取了 B 的账本，但未把它当作 A 的成功证据。任务停止原因为 `missing-successful-task-receipt`，即请求的目标 ID 没有匹配回执；未写入、补偿、重放或修改工程。

- runId：`d7fc4f89-0cd0-4e06-8f65-7c352d022fe9`。
- trace：`~/.local/state/CocosAgent/agent-runs/2026-10-16T12-26-13-020Z-ebcbbfca.jsonl`。

## Button 改名写入验收状态

计划目标为：仅将 UUID `596pYOww9MqobiatZyhu6v` 的 `node.name` 从 `AgentAcceptanceSprite` 改为 `Button`；不添加 Button 组件、不改其他字段、不做预览或点击验收。实际批准写入与补偿尚未进行，因此此项不能标记为通过。

在计划前置检查中，面板成功读取 `cocos2-scene-node-operations` skill、其声明的 `agent-foundation/scene-node-patch-prefab-0.1.md` 引用，并成功实时 inspect 了目标节点。一次计划尝试还调用了 `scene.snapshot`，但参数无效（`INVALID_ARGUMENT`）；后续计划明确不调用该工具，改以实时 inspect 绑定 UUID 和 before 值。

Creator 旧 Assistant Host 先后拒绝了多个候选 Plan：`INVALID PLAN UNKNOWN_TOOL`、`INVALID PLAN TOOL COVERAGE`、`plan-task-catalog-not-read`、`INVALID PLAN REQUIRED_TOOLS`。其中一份 Plan 将 skill 研究工具错误放进未来步骤的 `requiredTools`；修正提示后，面板成功生成结构完整的 2 步 Plan，最终目标精确绑定到 UUID `596pYOww9MqobiatZyhu6v` 的 `node.name = Button`。

Plan 模式先产生过五步候选计划；之后 Creator UI 展示了可审阅的 2 步计划：实时 inspect 确认目标、单次改名并核对编辑器/磁盘/operationId。补偿按计划单独审批，不在本次计划内。点击“开始第 1 步”后，执行 Host 把“按已批准计划执行只读 inspect”误判为 `task-intent-needs-clarification`，未调用 inspect。此后直接在 Agent 输入同样的完整写入任务也触发澄清；将输入精简为单一明确写入意图后，Host 正确识别为“读写混合”，读取 skill 目录、scene-node-operations skill、合同引用并实时 inspect 目标，随后提出一次精确写入审批。

- 最近可审阅 Plan 的 Creator trace：`~/.local/state/CocosAgent/agent-runs/2026-10-16T12-57-47-971Z-e888abad.jsonl`。此前 Host 意图误判 trace：`~/.local/state/CocosAgent/agent-runs/2026-10-16T12-59-24-182Z-4d1febd8.jsonl`；包含完整但被误判请求的 trace：`~/.local/state/CocosAgent/agent-runs/2026-10-16T13-00-01-884Z-9a6de3d7.jsonl`。
- 最小写入意图 run trace：`~/.local/state/CocosAgent/agent-runs/2026-10-16T13-01-45-496Z-55e30bc0.jsonl`。该次意图识别为读写混合，产生面板中的待审批 operation。
- 最新精简请求的 Creator run 已在面板等待批准：operationId `ac8c4af7-c4f9-45c8-99cc-25169e1215a2`，命令 `scene.node.patch`，仅 `node.name: AgentAcceptanceSprite → Button`，目标路径和 UUID 与隔离工程一致。尚未收到人类面板批准，因此命令尚未执行，不能记录写入完成。
- 隔离扩展包之前已重新打包，`structured-plan.mjs` 与仓库当前修正一致，Creator UI 版本显示 `0.3.16`。本轮运行时没有绕过 Creator Agent 的审批门槛。
- 本次项目磁盘核验仍显示 `assets/Scene/helloworld.fire` 的 `_name: AgentAcceptanceSprite`；目前没有成功的 Button 改名回执。

## 代码修正与自动验证

`tools/cocos-agent-bridge/mcp/structured-plan.mjs` 现在会从唯一 JSON 对象前剥离自然语言说明，同时拒绝尾随的第二段文字；Plan schema 可引用已注册、供后续独立审批使用的 `cocos_2x_command_execute` 与 `cocos_2x_script_patch`，而不会把它们开放给当前只读 Plan 的模型调用；scene 写命令覆盖要求只对 `write`/`restore` 步骤生效。

回归测试新增前言解析、尾随说明拒绝、Plan 未来写工具、只读步骤提及写命令等场景。

- `node --test tools/cocos-agent-bridge/mcp/structured-plan.test.mjs`：9/9 通过。
- 在 `tools/cocos-agent-bridge/mcp/` 执行 `npm test`：99/99 通过。
- `git diff --check`：通过。

**当前结论：** 解释请求、精确账本读取和错误 ID 回执拒绝已有 Creator 2.4.15 面板证据。面板现在能生成目标绑定正确的计划，精简 Agent 请求能到达精确的单次写入审批卡片；该 operation 尚待人类批准。批准写入后的编辑器/磁盘/账本读回，以及另行审批的补偿和补偿后读回，尚未完成。不得把候选 Plan、审批卡片或本地自动测试当成已实机写入验收。
