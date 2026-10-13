# CocosAgent 原生迁移后验收（Creator 2.4.15）

日期：2026-10-13，重启后复验至 13:58 UTC。结论：**Creator 原生面板的只读主链路和专用场景快照入口均通过重启后复验；安装技能包仍落后于仓库源包，且 Agent 最终摘要的技能数与原始回执不一致。** 本记录只覆盖 Codex 插件卸载后的 Creator 原生面板路径，不证明 Ask、Plan、写入、运行观察、上下文压缩或长期记忆的完整端到端能力。

## 环境

- 入口：Creator 2.4.15 菜单“扩展 → CocosAgent → Assistant”，原生面板显示已连接 DeepSeek Flash，Key 已保存在本机。
- 工程：`/Users/youjunmao/WORK/Cocos_Engine/2.4.15NewProject`；实例为 `ready`，编辑器与 Host 合同兼容，活动场景 `helloworld`。
- 面板扩展 `0.3.16`，MCP runtime `0.3.3`，安装的 Agent 技能包 `cocos-agent-2x@0.3.2`，fingerprint `d25e0396e258cec74510b3ab3618ac89fa76c52a9bb80be6d855382e6199fdeb`。
- 本次真实面板运行使用 Creator 管理的 Host；没有使用 Codex 插件或 Codex MCP Host。

## 成功的只读任务

原生 Agent runId：`2e1add85-d53d-4246-8782-ad9397a190cf`。本机原始运行记录：`~/.local/state/CocosAgent/agent-runs/2026-10-13T13-50-17-582Z-67905902.jsonl`。

运行记录中的成功工具回执依次包含实例列表、能力目录、技能索引、`cocos2-mcp-tools` skill、其 `agent-foundation/cocos-agent-mcp-0.1.md` 引用、实例详情及场景快照。skill SHA-256 为 `8807a5d5e525e110a72909c0acfab1963521315be2f4a000c741f86ef9aa78ff`；引用 SHA-256 为 `c2ffc7a9e61460902010393dfc952222544963b9b1657c2b348c00e0f025e6d0`，均与 Creator 返回的索引一致。原始 `skills.listed` 事件报告 13 项 skill，索引 SHA-256 前缀为 `8d7c3d7e`。

快照命令 `scene.snapshot` 成功返回 `helloworld` 场景 UUID `2d2f792f-a40c-49bb-a189-ed176a246e49`、19 个节点、`truncated=false`，选择为空。回执 `operationId=null`、`phases=null`；工具事件没有写入或恢复操作。

这项快照是通过通用 `cocos_2x_command_execute` 执行。Creator 面板因此弹出审批卡片；操作员只批准了参数明确为 `command=scene.snapshot, input={}` 的只读请求。Agent 最终文字称“未发起审批请求”，与面板事件不符；面板的最近任务卡也将该通用执行器列为“已发生或可能发生的写入”。审计时以实际 UI 事件和工具回执为准：确有一次只读调用审批，没有项目写入。

## 重启后的复验

Creator 重启后新建只读任务，原生 TS Agent runId：`a7de5414-1964-4e1c-97cc-ba9be864af65`；原始记录：`~/.local/state/CocosAgent/agent-runs/2026-10-13T13-58-18-656Z-f8b6e76e.jsonl`。面板扩展重新连接 DeepSeek Flash。运行成功发现 48 个 Creator 工具，读取实例列表和能力目录；当前工程仍是 `/Users/youjunmao/WORK/Cocos_Engine/2.4.15NewProject`，Creator `2.4.15`，状态 `ready`，editor/host 合同均 `matched`、无 blockers。活动场景仍为 `helloworld`，UUID `2d2f792f-a40c-49bb-a189-ed176a246e49`。

这次直接调用专用只读工具 `cocos_2x_scene_snapshot`，成功回执 `outcome=completed`、`operationId=null`，返回 19 个节点、`truncated=false`，selectionCount 为 0。技能包回执为 `cocos-agent-2x@0.3.2`，fingerprint `d25e0396e258cec74510b3ab3618ac89fa76c52a9bb80be6d855382e6199fdeb`，索引 SHA-256 `8d7c3d7eeb41bb008fa539d2493a5b46055993cb5636fcdef92bcafe37f619c5`。`cocos2-mcp-tools` 正文和 `agent-foundation/cocos-agent-mcp-0.1.md` 引用仍分别以 `8807a5d5…78ff` 和 `c2ffc7a9…e6d0` 校验通过。

技能数以工具回执为准：原始 `skills.catalog.loaded` / `skills.listed` 事件均为 **13 项**；Agent 最终生成的报告写成 **12 项**，与成功回执矛盾，属于摘要准确性缺陷。Creator 中仍安装 0.3.2、13 项，而仓库源包为 0.3.3、14 项；升级验收仍待完成。

本次实际使用的工具全为只读：`cocos_2x_instances_list`、`cocos_2x_capabilities_list`、`cocos_2x_skills_list`、`cocos_2x_skill_read`、`cocos_2x_skill_reference_read`、`cocos_2x_scene_snapshot`，以及一次 `sideEffect=none` 的实例详情尝试。没有调用 `cocos_2x_command_execute`，没有审批请求、写入、预览、构建、补偿、重放或记忆更改，也没有使用 Codex MCP。

## 先前专用读取复验

第二个原生 Agent runId：`2d6336b8-9ebe-4826-8a58-d860becb87ef`；记录：`~/.local/state/CocosAgent/agent-runs/2026-10-13T13-53-22-959Z-de05b588.jsonl`。任务指定只调用 `cocos_2x_scene_snapshot`，并禁止通用执行器。实例、能力、技能索引、skill 与引用均成功读取，但运行没有产生场景快照工具调用，最终以 `missing-successful-task-receipt` 停止。由此只能确认该专用入口尚未通过原生 Agent 验收，不能据此断定工具在所有 Host 配置中都不存在。

更早的 `2e1add85-d53d-4246-8782-ad9397a190cf` run 使用通用 `cocos_2x_command_execute` 成功读场景，并产生了一次明确的只读命令审批。Agent 最终文字与审批事件不符的问题仍需单独修正；本次重启复验使用专用快照工具，没有审批。

## 验收范围

已验证 Creator 原生面板在重启后重新连接、Creator 管理的 Agent 工具循环、实例与能力读取、安装 skill 和合同引用哈希校验，以及专用工具进行真实场景只读快照；复验未产生任何写入或审批。

后续仍需将 Creator 安装的技能包升级到仓库当前版本，并修正 Agent 摘要中技能数量与原始收据不一致的问题。通用执行器对只读命令的审批/任务卡片呈现也应单独修正；本次专用工具成功已消除它作为当前只读主链路门槛的影响。
