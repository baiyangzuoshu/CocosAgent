# Creator 2.4.15 原生 Agent 补偿与预览验收轨迹（2026-10-16）

## 隔离环境

- Creator：`/Applications/Cocos/Creator/2.4.15/CocosCreator.app`，版本 2.4.15。
- 隔离工程：`/private/tmp/CocosAgentNativeAcceptance-20261016`。
- Agent 扩展显示版本：0.3.16；当前工程 MCP/skill package fingerprint：`9eb7a702eb718e117efc7b3cb1e0ecac59e0b86647a0292828b3a283c6e8a65c`。
- Creator 将 Web 预览分配到 `http://127.0.0.1:7457/`；默认端口 7456 当时由另一工程占用。此次验证覆盖指定 loopback URL、Creator active-scene UUID、运行时 scene UUID 及同一目标节点 UUID，不证明端口到编辑器实例的密码学归属。
- 场景：`helloworld`，UUID `2d2f792f-a40c-49bb-a189-ed176a246e49`。
- 目标：`helloworld/Canvas/AgentAcceptanceSprite`，UUID `596pYOww9MqobiatZyhu6v`，SpriteFrame UUID `31bc895a-c003-4566-a9f3-2e54ae1c17dc`。

## 操作与结果

原生 Agent 在用户批准后执行了唯一内容变更：operation `7c1a4f52-9d3b-4e8a-b6c1-2f5e8d0a41b7` 将目标节点 `node.position.x` 从 `-150` 改为 `-149`；唯一差异字段为 x，y 保持 `180`。Creator 编辑器写入和磁盘读回均为 `passed`。

之后在同一 Creator 工程的 7457 预览中读到相同场景 UUID 和节点 UUID，运行时位置 `(-149,180)`，帧数 `11170`、采样增量 `85`、暂停为 false，捕获错误和页面错误均为 0，960×640 JPEG 可用。Agent 将该证据经面板批准记入原 operation，原 operation 的 `preview` 阶段变为 `passed`。另一轮 Ask 只读也独立观察到相同目标，帧增量 81、错误 0、截图可用。

随后 Agent 按原操作账本创建补偿 operation `b3d0f4ac-6a1e-4f2b-9c77-8e5a1d20c9f6`，其 `manifest.action=compensate`、`manifest.sourceOperationId=7c1a4f52-9d3b-4e8a-b6c1-2f5e8d0a41b7`，唯一差异为 x `-149 → -150`。经第二次面板批准后，补偿回执的 editor、disk、recovery 均为 `passed`，preview 为 `skipped`（补偿不要求运行预览）。

终核从 Creator MCP 再次读取两条 operation：原操作 `preview=passed`；补偿操作来源、目标 UUID、差异方向一致且 `recovery=passed`。Creator 的 `scene.node.inspect` 对同一节点 UUID 读回 `(-150,180)`。直接读取隔离工程序列化场景 `assets/Scene/helloworld.fire`，目标 `_id=596pYOww9MqobiatZyhu6v` 的 `_trs.array` 位置头两项也为 `[-150,180]`；该文件 SHA-256 为 `c88a6125bd75e195fde49731b17599ce99f9a0a333e20d7515625b23e4ecd238`。隔离工程最终状态回到原值，没有 replay。

## Agent 会话与边界

- 写入原始回合：`~/.local/state/CocosAgent/agent-runs/2026-10-16T00-44-17-459Z-192fbaff.jsonl`（runId `259efab6-1911-4753-bc2c-27086804e32a`）。写入、编辑器/磁盘读回和节点检查通过；旧 observer 固定访问 7456，导致该回合停在 `PREVIEW_SERVER_UNAVAILABLE`。
- 只读预览回合：`~/.local/state/CocosAgent/agent-runs/2026-10-16T00-52-02-265Z-80de1c38.jsonl`（运行时 7457、目标值和画布证据）。
- 只读原账本回合：`~/.local/state/CocosAgent/agent-runs/2026-10-16T00-52-45-445Z-63250ffd.jsonl`。
- 续验与补偿回合：`~/.local/state/CocosAgent/agent-runs/2026-10-16T00-53-41-329Z-a4d91307.jsonl`。预览登记和补偿均通过 Creator 面板授权执行。该 Agent 回合因工具调用上限未将自己的 goal 标成完成；后续 Ask 完成只读终核，不能把该 UI goal 状态改写为 completed。
- 终核回合：`~/.local/state/CocosAgent/agent-runs/2026-10-16T00-55-27-155Z-2c21a9d5.jsonl`，对应两条 ledger 读取和 Creator 节点检查。随后在本机只读直接解析 `.fire` 文件并计算 SHA-256，结果如上。

这次恢复提示还触发了任务目标解析回归：英文恢复句中的介词 `to` 曾被误认作节点目标，导致目标要求显示为 `to.node.position.x=-150`，Agent goal 未完成，尽管账本补偿成功。运行时已增加保留词过滤与回归测试；该解析修复通过 TypeScript runtime 自动测试，仍需在后续 Creator 原生 Agent 回合中复测目标提案/goal 收敛。动态端口、写入/预览/补偿及磁盘恢复本身有 Creator 2.4.15 原生证据。

## 后续只读验收器回归（2026-10-16）

只读请求按精确 ID 读取补偿 operation `b3d0f4ac-6a1e-4f2b-9c77-8e5a1d20c9f6`，并对同一节点 UUID 做实时检查。Creator Agent 成功调用 `cocos_2x_operation_get`（回执为 `completed`、`recovery=passed`）、技能与合同读取，以及 `cocos_2x_scene_node_inspect`；但面板 goal 将账本读回判为缺失。runId `d2d8720a-2453-4c8b-9744-69a18750adab`，记录 `~/.local/state/CocosAgent/agent-runs/2026-10-16T01-07-12-789Z-a93a94ff.jsonl`。没有发生写入。

程序修正为：只读验收要求成功回执、显式 `read` 访问级别及该 criterion 请求的精确工具名，不再用工具内部 role 分类否定有效只读证据；`cocos_2x_command_execute` 仍须是 task-role 且命令在只读白名单中。增加 role-independent read receipt 与写访问拒绝的自动回归。TypeScript runtime 115 项测试和上游固定快照校验通过；扩展已重打包/升级，要求 Creator 完整重启。完整退出后 Creator 进入 Dashboard；隔离项目卡片已重新加入最近项目，但此次自动 UI 点击未能打开项目，因此该补丁的 Creator 原生复验仍待完成。当前场景与账本值由前述 Ask 和磁盘检查确认是恢复后的 `x=-150,y=180`；本轮 Agent goal 未通过，不登记为实机验收通过。
