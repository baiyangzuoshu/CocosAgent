# CocosAgent 原生迁移后验收（Creator 2.4.15）

日期：2026-10-13，升级后复验至 14:10 UTC。结论：**Creator 重启本身不会更新工程内复制安装的扩展包；关闭 Creator 后显式升级并重新启动，已让面板从 0.3.3 技能包成功读取 14 项技能及更新后的合同引用。** 升级后的只读工具回执通过，但 Agent 最终任务被与只读验收无关的写入目标门槛标为未完成。本记录不证明 Ask、Plan、写入、运行观察、上下文压缩或长期记忆的完整端到端能力。

## 环境

- 入口：Creator 2.4.15 菜单“扩展 → CocosAgent → Assistant”，原生面板显示已连接 DeepSeek Flash，Key 已保存在本机。
- 工程：`/Users/youjunmao/WORK/Cocos_Engine/2.4.15NewProject`；实例为 `ready`，编辑器与 Host 合同兼容，活动场景 `helloworld`。
- 当前面板扩展 `0.3.16`、MCP runtime `0.3.3`、Agent 技能包 `cocos-agent-2x@0.3.3`，fingerprint `09a93c1ec72d86b7acbfff51dc592098ece718dce275bfa0a02588a76dc72a00`，与仓库源包一致。
- Creator 扩展是工程 `packages/cocos-agent-bridge/` 下的复制安装；重启只重新加载该目录，不会从仓库更新副本。关闭 Creator 后使用 `upgradeCreatorExtension` 显式打包/替换，并保留回滚目录 `2.4.15NewProject/packages/.cocos-agent-bridge.rollback-24053-1791900395314-e165e18a/`；随后重新打开 Creator，才加载新版。
- 本次真实面板运行使用 Creator 管理的 Host；没有使用 Codex 插件或 Codex MCP Host。

## 成功的只读任务

原生 Agent runId：`2e1add85-d53d-4246-8782-ad9397a190cf`。本机原始运行记录：`~/.local/state/CocosAgent/agent-runs/2026-10-13T13-50-17-582Z-67905902.jsonl`。

运行记录中的成功工具回执依次包含实例列表、能力目录、技能索引、`cocos2-mcp-tools` skill、其 `agent-foundation/cocos-agent-mcp-0.1.md` 引用、实例详情及场景快照。skill SHA-256 为 `8807a5d5e525e110a72909c0acfab1963521315be2f4a000c741f86ef9aa78ff`；引用 SHA-256 为 `c2ffc7a9e61460902010393dfc952222544963b9b1657c2b348c00e0f025e6d0`，均与 Creator 返回的索引一致。原始 `skills.listed` 事件报告 13 项 skill，索引 SHA-256 前缀为 `8d7c3d7e`。

快照命令 `scene.snapshot` 成功返回 `helloworld` 场景 UUID `2d2f792f-a40c-49bb-a189-ed176a246e49`、19 个节点、`truncated=false`，选择为空。回执 `operationId=null`、`phases=null`；工具事件没有写入或恢复操作。

这项快照是通过通用 `cocos_2x_command_execute` 执行。Creator 面板因此弹出审批卡片；操作员只批准了参数明确为 `command=scene.snapshot, input={}` 的只读请求。Agent 最终文字称“未发起审批请求”，与面板事件不符；面板的最近任务卡也将该通用执行器列为“已发生或可能发生的写入”。审计时以实际 UI 事件和工具回执为准：确有一次只读调用审批，没有项目写入。

## 首次重启后的复验（升级前）

Creator 重启后新建只读任务，原生 TS Agent runId：`a7de5414-1964-4e1c-97cc-ba9be864af65`；原始记录：`~/.local/state/CocosAgent/agent-runs/2026-10-13T13-58-18-656Z-f8b6e76e.jsonl`。面板扩展重新连接 DeepSeek Flash。运行成功发现 48 个 Creator 工具，读取实例列表和能力目录；当前工程仍是 `/Users/youjunmao/WORK/Cocos_Engine/2.4.15NewProject`，Creator `2.4.15`，状态 `ready`，editor/host 合同均 `matched`、无 blockers。活动场景仍为 `helloworld`，UUID `2d2f792f-a40c-49bb-a189-ed176a246e49`。

这次直接调用专用只读工具 `cocos_2x_scene_snapshot`，成功回执 `outcome=completed`、`operationId=null`，返回 19 个节点、`truncated=false`，selectionCount 为 0。技能包回执为 `cocos-agent-2x@0.3.2`，fingerprint `d25e0396e258cec74510b3ab3618ac89fa76c52a9bb80be6d855382e6199fdeb`，索引 SHA-256 `8d7c3d7eeb41bb008fa539d2493a5b46055993cb5636fcdef92bcafe37f619c5`。`cocos2-mcp-tools` 正文和 `agent-foundation/cocos-agent-mcp-0.1.md` 引用仍分别以 `8807a5d5…78ff` 和 `c2ffc7a9…e6d0` 校验通过。

技能数以工具回执为准：原始 `skills.catalog.loaded` / `skills.listed` 事件均为 **13 项**；Agent 最终生成的报告写成 **12 项**，与成功回执矛盾，属于摘要准确性缺陷。Creator 中仍安装 0.3.2、13 项，而仓库源包为 0.3.3、14 项；升级验收仍待完成。

本次实际使用的工具全为只读：`cocos_2x_instances_list`、`cocos_2x_capabilities_list`、`cocos_2x_skills_list`、`cocos_2x_skill_read`、`cocos_2x_skill_reference_read`、`cocos_2x_scene_snapshot`，以及一次 `sideEffect=none` 的实例详情尝试。没有调用 `cocos_2x_command_execute`，没有审批请求、写入、预览、构建、补偿、重放或记忆更改，也没有使用 Codex MCP。

## 升级后的复验

升级 Creator 工程扩展包并重新打开 Creator 后，原生 TS Agent runId：`b4188a63-0b3a-46f8-a4a8-7f2b7b0e7bae`；原始记录：`~/.local/state/CocosAgent/agent-runs/2026-10-13T14-09-33-550Z-3ef59d78.jsonl`。Creator 面板已重新加载并连接 DeepSeek Flash。面板原生工具成功读取实例列表、能力目录、技能索引、`cocos2-mcp-tools` skill、其合同引用，以及专用 `cocos_2x_scene_snapshot`（`outcome=completed`、`operationId=null`）。

运行原始 `skills.catalog.loaded` 和 `skills.listed` 收据均确认：版本 **0.3.3**、指纹 `09a93c1ec72d86b7acbfff51dc592098ece718dce275bfa0a02588a76dc72a00`、索引 SHA-256 `17f0e5a3fbabb3e554955da60e1e67a8c84bdd03674a6b2ce4dbf18d49a65db5`、技能 **14 项**。读取的 `cocos2-mcp-tools` SHA-256 为 `8807a5d5e525e110a72909c0acfab1963521315be2f4a000c741f86ef9aa78ff`；合同引用 SHA-256 为 `3384f6d5ea4d38d5083eb7172ac6dcc0ab9c2b36fc779beffb62a96854f61a12`。升级后引用哈希较早记录变化，是因为新包包含更新后的合同文件。

专用场景快照工具也成功返回，但该 run 的本机摘要未保留其场景数据；场景 UUID/节点数以升级前独立成功的快照记录为准，不将其冒充为升级后回执字段。当前 Creator 工程仍是 `/Users/youjunmao/WORK/Cocos_Engine/2.4.15NewProject`，面板上下文显示 Creator `2.4.15`、活动场景 `helloworld`。

所有 Creator 项目工具调用均为只读。TS 运行时额外调用了 `agent_todo_write` 更新 run-local 任务清单；没有执行项目内容写入。最终 run 状态为 `goal-unmet-continuation-limit`：面板把本次任务关联到旧的验收目标，要求本轮发生经批准的写入及账本读回，即使任务本身明确只读且所有只读清单已完成。这是 Agent 任务收尾/目标绑定缺陷，不代表技能包升级或读取失败；本轮没有调用任何写入命令，也没有审批请求。

## 先前专用读取复验

第二个原生 Agent runId：`2d6336b8-9ebe-4826-8a58-d860becb87ef`；记录：`~/.local/state/CocosAgent/agent-runs/2026-10-13T13-53-22-959Z-de05b588.jsonl`。任务指定只调用 `cocos_2x_scene_snapshot`，并禁止通用执行器。实例、能力、技能索引、skill 与引用均成功读取，但运行没有产生场景快照工具调用，最终以 `missing-successful-task-receipt` 停止。由此只能确认该专用入口尚未通过原生 Agent 验收，不能据此断定工具在所有 Host 配置中都不存在。

更早的 `2e1add85-d53d-4246-8782-ad9397a190cf` run 使用通用 `cocos_2x_command_execute` 成功读场景，并产生了一次明确的只读命令审批。Agent 最终文字与审批事件不符的问题仍需单独修正；本次重启复验使用专用快照工具，没有审批。

## 验收范围

已验证 Creator 原生面板在关闭后升级并重新启动、Creator 管理的 Agent 工具循环、实例与能力读取、已安装 0.3.3 skill 和合同引用哈希读取，以及专用场景快照工具成功执行。版本对齐已验收；升级后 Agent run 的最终状态被旧写入目标误判，场景字段没有从该 run 的回执摘要独立确认。

后续需修正 Agent 把旧写入验收目标绑定到新只读任务、导致成功只读回执仍被 `goal-unmet-continuation-limit` 判停的问题。通用执行器对只读命令的审批/任务卡片呈现也应单独修正；专用读取路径已成功执行。

## 2026-10-14 后续修正与重验状态

针对升级后只读任务收尾问题，TS 内核现在从本轮原始用户任务派生精确的只读验收项；显式要求的实例、能力目录、skill 索引/正文/合同引用和场景快照分别要求对应工具的成功回执。范围识别会先移除明确禁止的操作，避免“只读；不写入、不审批、不预览”的否定措辞被误判成写入请求；正向写入仍保留写入验收门槛。Host 预检产生的实例与能力回执现在以 `setup` 角色并入本轮程序验收及持久任务记录，只能满足用户明确要求且工具名完全匹配的只读验收项。runtime 自动测试 **75/75 通过**，上游固定基线校验 18/18 通过。

上述运行时已打包并通过 `upgradeCreatorExtension` 原子替换到 `2.4.15NewProject/packages/cocos-agent-bridge/`；版本仍为 0.3.16，保留回滚目录 `.cocos-agent-bridge.rollback-34562-1791907787277-8c6cd6ae`。安装包内 `creator-host-adapter.js` 与构建产物 SHA-256 均为 `343739cbefec46d4af66276771913c52e01edea6ff1c3987f1db554c681890c4`。升级器返回 `creatorReloadRequired=true`。

本轮无法完成升级后的原生面板重验：Creator 2.4.15 当前显示 Dashboard 的 Cocos 开发者登录页；尝试使用 Dashboard 的“打开”及最近工程入口后仍停留在该页，没有产生 Agent 任务。没有输入或提交账号凭据。Creator 面板的只读收尾、上下文压缩/证据取回及长期记忆流程仍标记为待实机验收。另运行 MCP/扩展整套 90 项测试时有 25 项失败，分布在 Plan schema/面板 DOM/Plan service 测试、固定包版本断言和运行观察测试桩；本次修改未涉及这些文件。需单独整理这组基线失败后再作为相关回归门槛。
