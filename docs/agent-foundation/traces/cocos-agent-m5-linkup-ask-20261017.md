# LinkUpClient Creator Ask 前置核对（2026-10-17）

## 目的与范围

在真实 LinkUpClient Creator 2.4.15 工程中确认原生 CocosAgent 面板可达、项目身份/约定/场景可读，并通过 Ask 只读分析筛选首个小功能候选。本次不批准或执行游戏代码、资源或场景写入。

## 证据

- Creator 窗口标题为 `Cocos Creator - LinkUpClient - db://assets/LinkUp.fire`；原生 Agent 面板显示工程 `LinkUpClient`、Creator `2.4.15`、活动场景 `LinkUp`。
- Creator 面板采样 `AGENTS.md` SHA-256 前缀为 `ae984519b3f1`。通过面板命令 `cocos_2x_project_instructions_read` 重新读取成功：8,140 字节，完整 SHA-256 `ae984519b3f1a808dad20546311c11701a031b1ce749f741f2a117a6aefa6f14`，与本机只读 SHA 一致。
- `scene.snapshot` 成功。活动场景 UUID 为 `cf82413e-bf17-4f19-99c5-89f3ef7a8503`；根节点 inactive，Canvas 下只有 MainCamera，当前无选中对象。该快照不能代表动态启动后的游戏界面。
- `cocos2-script-development` skill 读取成功，package 版本 `0.3.2`，skill SHA-256 `76fa4a471067eff7802b4731d4e32307767bb0856e63a99d7f4265149e11f6f1`。
- 项目目录状态只读核对发现既有删除 `LinkUpClient/assets/BundleLLK/Art.meta`，以及未跟踪 `LinkUpClient/packages/cocos-agent-bridge/` 和三个 rollback 目录。本次未修改或清理这些内容。工程 Git checkout 位于共享父仓库 `cc_framework`，分支 `main` 落后远端 1 个提交。

## 面板任务

- 模式：Ask（只读）。
- 请求：根据项目约定、代码与场景筛选一个适合真实功能验收的小功能，要求给出证据、范围、成功条件、Creator 验证步骤和恢复基线，并避开外部平台副作用。
- runId：`486b35b1-7a9c-4090-8bfa-027e1d8e73d0`。
- 本机轨迹：`~/.local/state/CocosAgent/agent-runs/2026-10-17T01-34-29-895Z-7f119d62.jsonl`。
- 时间：2026-10-17 01:34:29.895Z 至 01:34:59.321Z，约 29.4 秒。
- 工具调用：6 次只读调用，分别为实例列表、能力目录、项目约定读取、场景快照、工程记忆搜索、skill 读取；无写入回执或 operationId，无游戏工程副作用。
- 结果：Ask 提出检查“启动登录失败时是否缺少可见兜底”的候选；模型明确说明没有读到 `.ts` 源码、没有失败运行证据，不能断言这是现存 bug。它只能视为待调查假设。

## 首轮阻塞（当时）

面板此次没有提供可读取或写入本工程 TypeScript 源码的脚本命令。当前 LinkUpClient 安装包 `packages/cocos-agent-bridge/script-operations.js` 的 `SCRIPT` 路径 schema 以 `\.js` 结尾；写入读取逻辑还要求 `.meta.importer === "javascript"`。LinkUpClient 的业务/UI 逻辑主要位于 TypeScript，因此不能以 Ask 回答替代 TS 源码审阅，也不能直接进入 TS 功能修改、Creator 编译和源码读回。

Ask 任务本身成功完成，但它是 M5 的前置筛选，不是“需求—代码修改—Creator 编译—运行/交互断言—审阅/恢复”的真实功能样本，不纳入功能成功率分母。当前 M5 有效功能样本仍为 0；成功率、功能任务耗时、写入批准/介入次数与恢复结果均未采集。

## 2026-10-17 M1 修复与原生复测状态

- 第二次 Creator Ask 的只读运行记录：`~/.local/state/CocosAgent/agent-runs/2026-10-17T01-41-56-322Z-fc21ddd3.jsonl`。它确认内存中的旧 Host 为扩展 0.3.4、MCP 0.3.3、Agent 包 0.3.2；`project.search` 当时缺失，脚本读写因合同不匹配不可用。没有发出源码读工具、没有网络请求或写入。
- 代码核对发现 Creator 扩展包 `script-operations.js` 与 Host `script-contract.js` 不一致，且 Creator 命令分发虽登记 `project.search`，脚本服务没有搜索执行分支。已将有界项目搜索实现纳入共同合同，使 `.ts` 内容搜索返回文件身份/UUID/Importer 元数据，并允许 `script.read` 对 TS 检查 importer、UUID、源与 `.meta` SHA-256；Creator 编译仍要求 2.4.15 Importer 的真实编译产物证据。操作账本合同版本与扩展目录公开的 `script.*` 0.2 对齐。
- 新增/修正自动测试后：`script-operations.test.js` 11/11 通过（含 TS 搜索和读取）；`catalog-extension-contract.test.js` 通过；`creator-package.test.mjs` 4/4 通过。现有包技能资源清单断言从 14/33 更新为当前包的 17 项 skill/37 项唯一引用。打包目录为 `/private/tmp/CocosAgentCreatorPackage-m5-20261017-04`。
- LinkUpClient 的磁盘扩展目录已安全升级为 0.3.18，旧包保留在 `packages/.cocos-agent-bridge.rollback-83407-1792201612040-4be745db`；升级命令回执为 `creatorReloadRequired: true`。此前只执行“开发者 → 重新加载界面”不足以让 Assistant Host 重新加载。本轮 CUA 后续不能重新绑定 2.4.15 编辑器窗口，因此 Creator 内存扩展/MCP/Agent 包版本、兼容目录、`project.search` TS 命中和 `script.read` TS 回执都尚未验收。
- 没有读取 LinkUpClient 的业务 TS 源码，没有修改 LinkUpClient 的游戏代码、场景、Prefab 或资源；M5 功能样本仍为 0。工作区既有删除的 `assets/BundleLLK/Art.meta` 与未跟踪目录仍需保留。

## 后续门槛

1. 重新聚焦/打开 LinkUpClient 的 Creator 2.4.15 主窗口，确认 0.3.18 磁盘扩展已加载；重新连接 DeepSeek 后只读检查 `contractCompatibility`、`project.search` TS 结果、`script.read` 的 TypeScript importer/UUID/源哈希回执。
2. 保护现有项目工作区差异；在任何写入前，对账未决 operation 并核对 Agent 面板采样的 `AGENTS.md` 哈希。
3. 只读通道确认后，读取实际启动链路和相关资源/Prefab，再由代码与运行证据决定是否选择登录失败兜底；若假设不成立，另选有证据的小功能。
4. 固定成功条件、排除项和恢复基线后，由 Creator 原生 Agent 面板发起功能任务，再按 M5 样本口径记录完整结果。
