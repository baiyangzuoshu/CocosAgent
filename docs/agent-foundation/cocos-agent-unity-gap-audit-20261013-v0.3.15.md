# CocosAgent 0.3.15 与 Unity Editor Assistant 的能力复核

日期：2026-10-13。代码基线：`31a9b7e`，Creator 扩展 `0.3.15`，目标 Creator `2.4.15`。

这是源码、合同和已有轨迹的静态复核。本轮没有运行测试、调用模型或执行 Creator 写入。Unity 对照采用公开的 Assistant `2.10.0-pre.1` 手册及官方产品说明；不代表两者在相同项目中经过性能或成功率测量，也不推断 Unity 未公开的内核实现。

## 1. 项目整体构成与当前阶段

| 层 | 仓库位置 | 当前作用 |
| --- | --- | --- |
| 引擎与研究 | `engine/2.4.15engine/`、`docs/2.x/`、`docs/3.x/` | 引擎、资源生命周期、平台、渲染及内存研究；研究结果不能自动算成 Agent 工具 |
| Creator 原生入口 | `2.4.15NewProject/packages/cocos-agent-bridge/` | 面板、工程/场景/选择上下文、凭据、服务启动、编辑器主进程和场景脚本桥接 |
| 单 Agent 内核 | `tools/cocos-agent-runtime/src/` | TS/Node 模型循环、工具注册、策略、审批、hooks、执行清单、任务图、目标续跑、压缩、证据档案、工程记忆 |
| Host 与受限命令 | `tools/cocos-agent-bridge/`、其 `mcp/` | Creator 命令合同、身份校验、操作记录、保存读回、批次/流水线、内容构建/预览、会话/计划/任务持久化 |
| 产品技能 | `plugins/cocos-agent-2x/skills/`、`references/` | 当前 14 项 skill、31 项引用；原生运行时自带发现/读取/哈希校验，不依赖 Codex 技能缓存 |
| 上游研究与证据 | `vendor/learn-claude-code/`、`docs/agent-foundation/` | 固定源码对照、产品合同和实机轨迹；Python 课程不是产品运行依赖 |

当前源码声明 19 个 Creator 语义命令，另有 Host/MCP 组合、内容与恢复入口。声明数量不等于可用性或验收数量；每次执行仍以实时目录、版本、实例和合同为准。

判断：已有独立运行的原生 Agent 基础、受约束的编辑能力和若干实机闭环，整体处于**真实项目能力扩展和验收阶段**。完整 UI 功能开发仍缺检索、脚本创建/挂接、通用组件编辑和功能验收。

## 2. 与 Unity 原生助手的对照

| 维度 | Unity 公开能力 | CocosAgent 已有 | 当前缺口 |
| --- | --- | --- | --- |
| 编辑器内独立 Agent | Editor 内项目感知助手，Ask/Plan/Agent | Creator 面板管理 Host/MCP，独立模型接入和三模式 | 当前 Windows 游戏工程的完整开发任务端到端证明不足 |
| 项目上下文 | 场景、对象/组件、包版本、构建/平台、Console；可附加相关内容 | 工程/场景/选择上下文，实时快照，PNG 按名检索，精确 JS/Prefab 读取 | 通用脚本/资源发现、文本与符号检索、组件引用关系、Creator Console、包/平台/构建配置上下文 |
| 计划 | 澄清、修订、审批、进度；可保存为项目中的 Markdown | 结构化 JSON 计划、审批、分步执行、持久化和恢复；非法计划现在明确失败 | 反馈修订/重排体验；计划的业务验证条件尚未变成统一可执行验收 |
| 场景与组件 | 预定义工具可创建/删除对象、增删组件、修改设置 | 节点创建、受限 patch、PNG Sprite、Prefab 创建/实例化 | 通用节点增删/复制/层级调整；Button、Widget、Layout、EditBox、ScrollView、Mask、自定义组件与事件引用 |
| 脚本开发 | 官方说明包含写代码及多脚本任务 | 已有 JS 读取、精确修改、编译对账、补偿/重放；按钮研究任务有实机记录 | 新建 JS/TS、修改 TS、脚本发现、挂接组件、序列化属性/对象绑定、关联多文件修改 |
| Prefab | 场景/资源工具与 Prefab 上下文 | 创建/实例化有历史底层证据；源 inspect 和 0.3.14 场景进程 save/pop 桥接 | 源编辑多轮真实验收；改名后的路径读回仍有缺陷；通用 Prefab 组件/结构编辑 |
| 资源 | 项目资产上下文；可选本机视觉 Asset Knowledge | PNG 导入/UUID 链/引用、资源到场景流水线、Bundle、release 与回滚 | 通用资源类型/依赖发现、图集/字体/音频/动画/材质；视觉语义检索；生成器属于可选后续范围 |
| 运行与视觉 | Console 项目上下文、图片附件、截图与标注 | Web 日志、帧/暂停、节点字段、画布图像；0.3.15 Windows 浏览器发现与同页观察 | 新会话实现实机验收；认证预览端口归属；自动输入、功能断言、Editor 截图/参考图附件、JSB/小游戏观察 |
| 恢复 | checkpoint Git 快照与恢复设置 | UUID/hash/before、逐项操作账本、不确定写入锁、补偿及新 ID 重放 | 面向用户的检查点、整项任务差异/恢复；逐项补偿不等同于整个工程的事务回滚 |
| 权限 | Allow / Ask Permission / Deny 与 Autorun | 读写分离、每项写入批准、项目约定哈希、同轮 skill/reference 证据门槛 | 明确权限配置、批准/拒绝/恢复状态统一展示；不应为减少点击绕过现有写入约束 |
| 长任务 | 计划、对话、进度与执行详情 | hooks、Todo、持久任务图、目标续跑、记忆、压缩、run 内证据找回、取消 | 重启/取消/记忆修订/压缩/续跑的原生面板实机验收；一般功能仍受工具和轮次预算约束 |
| 模型与面板 | 多模型、工具参数/结果展开、图片操作、兼容更新提示 | DeepSeek Flash/V4 Pro；Markdown、版本、清空、复制、截图和日志导出 | 多 Provider、流式输出、结构输出保障、用量反馈、参数/完整回执/附件/计划修改/升级诊断体验 |
| 构建与性能 | 平台/构建上下文；具体范围依工具 | 2.4.15 Web-Mobile 内容构建与 readback；Bundle/动态资源/释放/压力与 Native 内存研究 | 通用游戏构建/平台任务与可重复性能预算闭环；研究探针尚未普遍成为原生 Agent 工作流 |

Unity 三模式及实时上下文依据：[官方介绍](https://unity.com/blog/unity-ai-assistant-ask-plan-agent-mode-explained)。计划修订与保存依据：[Plan 手册](https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.10/manual/about/assistant-plan-mode.html)。对象/组件与工具详情依据：[工具手册](https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.10/manual/assets/assistant-tools.html)。权限和 Asset Knowledge 依据：[配置手册](https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.10/manual/reference/preference.html)。图片依据：[视觉支持](https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.10/manual/automate/image-support.html)。检查点依据：[检查点设置](https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.10/manual/reference/checkpoints-reference.html)。多模型及外部接入依据：[官方产品页](https://unity.com/features/ai)。这些公开说明不证明 Unity 对任意点击/网络功能都能自动验收。

## 3. 已有证据及不能扩大解释的边界

- 原生 Ask/Agent 有只读场景与 skill/reference 读取证据；TS Agent 有一次受限场景补偿的真实闭环。
- PNG 原生任务有创建/保存/重开/预览/补偿/新 ID 重放轨迹。后续演示节点保留，不应为了“再验收”重复写入。
- 已有 JS 按钮任务有模型批准写入、编译、外部可见页面实际点击、补偿和恢复后的行为验证。物理输入的外部证据不等于原生 Agent 具备自动交互工具。
- Prefab 创建/实例化、PNG/Bundle 内容构建/应用/回滚、资源释放和驻留有各自专门证据，主要覆盖 2.4.15 PNG/Web 路径，不能推广到所有资源/平台。
- 记忆、压缩、任务图、取消、持久会话等有实现和历史自动测试。尚未收完原生面板各自的真实重启、恢复和故障路径。
- 0.3.12 的 Plan 状态和 0.3.13 的自由任务验收已修复并有相关自动测试记录；0.3.14 Prefab 桥接及 0.3.15 会话/浏览器更新只有本轮静态检查、构建和安装校验，真实 Creator 验收仍缺。

证据入口：[原生开发计划](F:/github/CocosAgent/docs/agent-foundation/cocos-agent-real-project-development-plan.md)、[PNG 轨迹](F:/github/CocosAgent/docs/agent-foundation/traces/cocos-agent-native-png-write-2.4-20261011.json)、[按钮轨迹](F:/github/CocosAgent/docs/agent-foundation/traces/cocos-agent-native-button-script-2.4-20261011.json)、[Prefab 合同](F:/github/CocosAgent/docs/agent-foundation/prefab-source-edit-0.1.md)、[运行观察合同](F:/github/CocosAgent/docs/agent-foundation/cocos-agent-runtime-observation-0.1.md)、[记忆合同](F:/github/CocosAgent/docs/agent-foundation/cocos-agent-project-memory-0.1.md)、[压缩合同](F:/github/CocosAgent/docs/agent-foundation/cocos-agent-context-compaction-0.1.md)。

## 4. 当前仍有的代码问题

### P0：批准计划没有接入与自由任务相同的业务验收语义

[assistant-host.mjs:601](F:/github/CocosAgent/tools/cocos-agent-bridge/mcp/assistant-host.mjs:601) 把当前计划步骤的 `requiredTools` 转成“每个工具有成功回执”的 goalCriteria；[creator-host-adapter.ts:215](F:/github/CocosAgent/tools/cocos-agent-runtime/src/creator-host-adapter.ts:215) 有显式条件时选用它们，不使用自由任务条件。[task-system.ts:16](F:/github/CocosAgent/tools/cocos-agent-runtime/src/task-system.ts:16) 对没有 `receiptRequirement` 的条件采用一般成功回执判断；[assistant-plan-service.mjs:66](F:/github/CocosAgent/tools/cocos-agent-bridge/mcp/assistant-plan-service.mjs:66) 继续按成功工具名推进步骤。

`validation` 是经长度校验后交给模型的字符串，尚未编译成目标 UUID/字段、源码版本、运行状态或交互断言。已有工具覆盖检查、预览验收和不确定写入锁仍有效，但工具执行成功不能证明任意计划中的业务目标。仅修复非法 Plan JSON 的终态不能解决这一层问题。

建议为步骤定义可执行的验收条件，并在最后对整项用户目标验收。预检步骤不应被迫满足最终写入条件；最终步骤也不能只凭读工具回执宣告功能完成。

### P1：Prefab 改名后的重开快照仍比较旧路径

[main.js:889](F:/github/CocosAgent/2.4.15NewProject/packages/cocos-agent-bridge/main.js:889) 重开后仍传入操作记录中的原 `targetNodePath`；[scene.js:69](F:/github/CocosAgent/2.4.15NewProject/packages/cocos-agent-bridge/scene.js:69) 虽先按 UUID 定位，却接着把节点当前路径与该原路径比较。若 `node.name` 成功改变并保存，路径末段已经变化，该读回会被 `PREFAB_NODE_IDENTITY_MISMATCH` 拒绝，主进程按可能已有副作用返回失败。

这是静态确认的路径矛盾，尚未实机复现。本次分析不执行写入或补偿。应按 before/after 名称派生预期路径，同时保留 UUID、父级、同名与磁盘关系校验，不能简单去掉路径检查。

### P1：新观察器接线尚缺同步后的回归证据

[mcp-server.test.mjs:80](F:/github/CocosAgent/tools/cocos-agent-bridge/mcp/mcp-server.test.mjs:80) 的注入观察器仍严格断言旧参数对象；当前入口已加入 `projectRoot/instanceId`，并增加观察后的能力目录核对。旧断言与当前调用不一致。这里没有运行测试，因此不写成完整测试套件已失败或已通过；需同步接线断言并覆盖复用、手动关闭、写后刷新、累计错误及并发失效，再做真实 Windows 验收。

### P2：凭据文案与存储方式不一致

[credential-store.cjs:61](F:/github/CocosAgent/2.4.15NewProject/packages/cocos-agent-bridge/credential-store.cjs:61) 存储在本机用户目录的 `credentials.env`；代码没有系统密钥链加密实现。[panel/index.js:407](F:/github/CocosAgent/2.4.15NewProject/packages/cocos-agent-bridge/panel/index.js:407) 却显示“正在恢复本机加密凭据”。应先使文案准确，再按产品需要引入 Windows Credential Manager 等系统存储。本轮没有读取真实凭据。

## 5. 面向真实游戏开发的主要缺口

1. **发现工程内容。** 能从功能描述找到相关 JS/TS、组件、Prefab 和资源，并给出引用关系。当前 PNG 搜索和精确路径读取不足以回答“整个登录逻辑在哪里”。
2. **创建/修改完整 UI。** 节点创建目前只允许最多一个 Sprite 或 Label；patch 不开放 Label 文本、通用 UI 属性、组件增删、事件和自定义字段。网络连接弹窗需要 Button/Widget/Layout、状态文字和对象引用等能力。
3. **脚本进入真实工程。** 现有合同只接受已有 `.js`，源码上限 64 KiB；缺 TS、创建、挂接和属性绑定。引擎本身支持 TS 不等于 Agent 有 TS 编辑合同。
4. **功能验收。** 持续页面观察已实现，但没有原生输入工具与可执行点击/网络结果断言。不能从画面、日志中的声明或读场景成功直接判定功能完成。
5. **可靠恢复与持续使用。** 逐项账本基础已在，需要把 diff、检查点、任务级恢复、重启和取消做成可理解且实测的产品入口。
6. **扩展资源/平台。** 由真实任务推动图集、字体、音频、动画、材质与平台命令。此前 Bundle/Native 内存研究可复用，但应逐个形成受控工具和验收，而非直接扩大全平台支持声明。

## 6. 建议推进顺序

| 顺序 | 工作 | 收口依据 |
| --- | --- | --- |
| 1 | 统一批准计划的业务验收，修正 Prefab 改名读回 | 工具成功但业务未完成不能进入 completed；改名后的 UUID/路径及保存、重开、补偿一致 |
| 2 | 收完 0.3.14/0.3.15 的隔离工程验收 | 原生 Prefab 多轮修改/恢复；Windows 同页物理点击/二次读取、写后刷新、关闭恢复和错误保留 |
| 3 | 增加 Creator 内容检索 | 输入功能描述即可定位脚本、组件、Prefab 与引用；结果均来自注册工程、受限工具 |
| 4 | 用一个可逆的网络连接弹窗任务补 TS/组件/绑定合同 | 创建/修改、编译、保存重开、实际状态变化和恢复有同一工程证据 |
| 5 | 收口持久会话、记忆、压缩、取消、差异和恢复体验 | 真实重启、故障注入、取消中的写入对账、候选记忆修订和证据取回通过 |
| 6 | 再补 Provider、流式体验、通用资产和平台 | 每个新增功能关联真实项目需求；技能与实现/验收范围同步 |

新增工作流按**命令合同 → 编辑器桥接 → 产品 skill → 原生实机验收**推进。有命令而缺步骤知识时补 skill；缺编辑器操作或观察入口时先补受限命令。

保持独立 Creator 原生 Agent 的产品方向。3.x 暂停新增仍是当前范围；通用 shell、子 Agent/团队和定时任务属于明确排除项，不列为对照 Unity 必补的能力。
