# Unity → CocosAgent 对照设计：发现、定位、结果与 skill

状态：设计稿及首条只读实现，2026-10-06。范围限定为本地开发机上已打开的 Cocos Creator 2.4.15、3.8.7 工程；不把 Unity 的命令名、序列化格式或宿主实现照搬到 Creator。两版 Creator 的公开行为仍分别以 [2.4 手册](https://docs.cocos.com/creator/2.4/manual/zh/)和 [3.8 手册](https://docs.cocos.com/creator/3.8/manual/zh/)为准，具体接线以本仓库代码和运行证据核对。

## 参考事实与边界

- Unity 的 Pipeline 包通过本地接口控制编辑器；CLI 可列出当前编辑器暴露的命令，多个编辑器运行时可用项目路径选定目标。[Unity Pipeline 文档](https://docs.unity.com/en-us/unity-cli/unity-pipeline/unity-pipeline-package)
- Unity CLI 的编辑器命令目录可按名称、标签查询，并输出机器可读结果；其 MCP 服务将已连接编辑器的命令暴露为工具，目录可随编辑器连接状态变化。[Unity CLI 集成说明](https://github.com/Unity-Technologies/skills/blob/main/skills/unity-cli/references/integration-advanced.md)
- Unity CLI 在目标不明确时返回候选实例；对编辑器明确拒绝执行的忙碌状态可在期限内重试，但超时或连接中断后的写入不自动重发，因为操作可能已经执行。[Unity CLI 集成说明](https://github.com/Unity-Technologies/skills/blob/main/skills/unity-cli/references/integration-advanced.md)
- Unity 的官方 Agent 插件把工作流知识放在 skill 中，许多 skill 经 CLI 操作打开的编辑器，而不是手改场景或资源文件。[Unity Agent 插件](https://github.com/Unity-Technologies/unity-agent-plugin)、[Unity skills](https://github.com/Unity-Technologies/skills)

这些材料公开的是接口、操作约束和工作流示例，不等于 Unity Assistant 或编辑器内部源码已公开。Unity CLI 官方标明仍处于实验阶段；本设计采纳可验证的接口原则，不依赖其具体协议稳定性。[Unity CLI 文档](https://docs.unity.com/en-us/unity-cli)

## 当前 CocosAgent 基线

现有 [Bridge 原型](../../tools/cocos-agent-bridge/README.md)由 Host 在指定项目的 `temp/cocos-agent-bridge/session.json` 发布一次性会话，Creator 版本专属扩展主动连接。`hello` 携带项目路径、Creator 版本、固定能力列表与 `scene.pngSprite` 合同声明；Host 核对后执行 `ping → scene.snapshot → 可选导入/场景操作`。场景写入已有[六阶段操作合同 0.1](cocos-agent-operation-contract-0.1.md)，两版各自实现预检、写入和保存，Host 读回内存与磁盘；预览回执目前为 `pending`。

新增的只读 [`catalog-host.js`](../../tools/cocos-agent-bridge/catalog-host.js)可同时连接多个显式指定的项目，调用扩展 `capabilities.list` 并读取活动场景，提供一次性 `instances.list/get` 与 `capabilities.list` 查询。这仍是短时连接，不是常驻实例目录；命令列表固定为三项，尚无跨会话查询和持久操作记录。`operationId` 仍随写入 Host 会话变化。下文的目标合同与现状须据此区分。

## 1. 命令如何发现

| Unity 参考 | CocosAgent 现状 | 目标设计 |
| --- | --- | --- |
| 从已连接编辑器列出当前可用命令及参数；目录会随编辑器状态变化 | 扩展在 `hello.capabilities` 中发送固定字符串列表；Host 按硬编码检查 | 增加只读 `capabilities.list`，返回带版本、参数 schema、访问级别、前置条件和状态的命令描述 |

命令 ID 使用稳定语义名，例如 `scene.snapshot`、`asset.importPng`、`scene.pngSprite`；**命令描述的版本**与桥接协议版本分开。目录条目至少包括 `id`、`contractVersion`、`creatorVersionRange`、`access`（`read`/`write`）、`inputSchema` 引用、`resultSchema` 引用、`preconditions`、`supports`（查询状态、补偿、预览验证等）。缺失命令返回 `UNSUPPORTED_CAPABILITY`；扩展安装但编辑器场景未就绪时，目录保留条目并报告 `unavailable` 与原因，避免把“暂不可执行”误判为“版本不支持”。

Host 只向 Agent 暴露 **扩展实际报告且 Host 已验证合同版本**的命令。目录必须在项目/版本握手之后读取；扩展重载、场景切换或资源状态变化时标记目录与上下文快照过期，写入前重新预检。初期用显式重新查询即可，订阅式目录变化可后做。不得把 Creator 内部任意消息或脚本执行入口直接开放成通用命令。

## 2. 如何定位正确的编辑器实例

| Unity 参考 | CocosAgent 现状 | 目标设计 |
| --- | --- | --- |
| 多实例时使用显式项目路径；不明确时返回候选项而不猜测 | CLI 必须提供 `--project` 与 `--creator-version`；扩展读取该项目的会话文件，Host 核对 `hello` | 维护本机实例目录；按规范化项目路径、精确 Creator 版本、会话身份选定唯一实例，冲突时拒绝写入 |

建议的实例描述为 `instanceId`（扩展启动时生成）、`projectRoot`（规范化绝对路径）、`creatorVersion`、`extensionVersion`、`connectionState`、`lastSeenAt`、`activeScene` 和 `capabilityRevision`。`instanceId` 不能代替项目身份：扩展重载会改变它；项目路径也不能单独代替进程身份：同一项目可能被重复打开。Host 在写入前同时核对调用者目标、握手身份、当前场景和操作请求的 `expectedScene`。当同项目出现多个候选、版本不符或活动场景变化时，返回结构化 `AMBIGUOUS_EDITOR`、`CREATOR_VERSION_MISMATCH` 或 `SCENE_CHANGED`，不选择“最近使用”的窗口。

继续维持仅本机连接、随机令牌、令牌时效、单会话连接和项目路径核对。操作 ID 与会话 ID 要分开：会话负责连接认证，操作 ID 负责跨重启状态查询与幂等。实例目录初期可由 Host 管理，不要求修改完整 Creator 编辑器本体。

## 3. 怎样表达执行结果

| Unity 参考 | CocosAgent 现状 | 目标设计 |
| --- | --- | --- |
| CLI 提供机器可读结果和错误；不确定写入是否发生时停止自动重试 | Host 输出 `operation.receipt {JSON}`，区分 capability、preflight、editor、disk、preview、recovery；无持久记录 | 一个稳定 `operationId` 关联完整生命周期；阶段回执持久化，查询接口可恢复当前状态与证据 |

沿用 [operation.schema.json](../../tools/cocos-agent-bridge/operation.schema.json) 的阶段、证据和结构化错误，补充顶层终态：`succeeded`、`failed_without_effect`、`needs_reconcile`、`compensated`。`pending` 的预览阶段不得把整个任务报为已通过。每条回执记录 `operationId`、目标实例、命令及合同版本、阶段、状态、观察时间、证据来源和关联场景/资源身份；读回证据和人工预览证据分开。错误至少保留 `code`、`phase`、`retryable`、`sideEffect`，不依赖错误文案做程序分支。

重试规则按**已知执行边界**决定：编辑器明确拒绝且无副作用的请求可以重试；写入超时、断线或保存状态不明时先执行 `operation.get` 与场景/磁盘读回，再决定继续、补偿或报告 `needs_reconcile`。跨会话 `replay` 必须带稳定操作 ID 或稳定幂等键，不使用新的 Host 会话 ID 来推断“同一操作”。持久记录需原子写入并能识别中断在编辑器写入与磁盘确认之间的情况。

建议所有外部调用返回一个统一 envelope：`requestId`、`instanceId`、`operationId`、`commandId`、`contractVersion`、`status`、`result` 或 `error`，再附六阶段回执。`result` 只表达编辑器返回值；任务是否完成由回执与终态共同决定。

## 4. skill 如何调用命令

| Unity 参考 | CocosAgent 现状 | 目标设计 |
| --- | --- | --- |
| 官方插件提供按任务触发的 skill，skill 经 CLI 驱动编辑器并核对结果 | 研究阶段已有 2.x、3.x 诊断 skill；操作型 skill 尚未形成统一调用流程 | skill 负责选择命令、准备输入、解释证据；Host 负责身份、schema、权限、执行与日志 |

一个操作型 skill 的最小流程：`定位项目和版本 → capabilities.list → 读取只读上下文 → 构造版本匹配的请求 → preflight → 执行 → operation.get/读回 → 预览或明确 pending → 失败时按回执恢复`。skill 必须声明适用 Creator 版本、官方手册入口、能力 ID 与合同版本、所需输入、预检条件、成功证据和不能自动重试的错误。2.4 与 3.8 可共享任务目标与验收清单，但各自的节点、资源、场景操作说明必须独立。

skill 不能绕过 Host 直接发 Creator 内部消息；不能凭目录中的能力名猜参数；不能将诊断笔记中的源码推论当作已验证的编辑器写入能力。Agent 可以使用外部 LLM，但模型供应商与 Key 不属于 Creator 扩展的本地通信合同。未来提供 MCP 或 CLI 时，应复用同一 Host 命令目录和回执合同，避免出现两套行为不同的写入接口。

## 实施顺序与验收

1. **实例与目录只读层**：实现 `instances.list/get`、`capabilities.list`，让两个已打开示例同时在线；按项目路径与版本精确选中，各自返回命令目录。无匹配、多匹配、扩展重载、活动场景改变均有明确状态。
2. **持久执行状态**：将 `operationId` 从会话 ID 分离，持久记录六阶段回执，增加 `operation.get`。在编辑器写入后、磁盘读回前人为断开 Host，再重启并读回确认，不重复创建节点。
3. **skill 试跑**：分别制作 2.4、3.8 的 PNG 放入场景操作型 skill；两者通过目录发现同一语义命令，各走本版预检与执行，最终证据能追溯到对应场景、资源和操作 ID。
4. **外部接入面**：待上述合同稳定后再包装 CLI/MCP。测试同一操作通过直接 Host 与外部接入面得到相同回执和错误码。

此设计先解决接入的确定性。资源批处理、运行时动态替换与引擎结构改造仍按[招聘目标设计](../cocos-agent-recruitment-aligned-design.md)推进，并以各版源码和实际运行证据决定具体改造点。
