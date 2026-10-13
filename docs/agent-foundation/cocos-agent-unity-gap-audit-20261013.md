# CocosAgent 与 Unity 原生 Agent：项目能力与缺口复核

复核日期：2026-10-13。仓库基线：`9618f3a`。Creator 扩展：`0.3.11`；MCP 包与产品技能包：`0.3.3`。当前产品目标仅为 Cocos Creator **2.4.15**。

## 结论

CocosAgent 已有独立 Creator 扩展、TS Agent 内核、产品技能读取、受约束编辑器命令、持久操作账本和若干真实任务闭环。下一阶段的主要差距是任务完成判定、真实工程上下文、通用脚本/UI 制作、同一运行会话的验证，以及安装和交互稳定性。

目前可以将它描述为“已有实机成果的 Creator 原生 Agent 原型”。尚不足以承诺：用户描述任意游戏功能后，Agent 都能自主发现相关文件、完成跨文件开发、修改组件绑定、实际运行验证并稳定恢复。

Unity 的比较对象为官方 **Editor 内 Assistant 的 Ask / Plan / Agent**。CLI、MCP 和外部 Agent 插件作为可选扩展面比较；Unity 的资源生成器作为更广产品能力列出，不当成 CocosAgent 近期启动门槛。公开页面访问时，Assistant 手册链接解析到 `2.10.0-pre.1`。这份报告比较公开能力和本仓库证据，没有对 Unity 做同条件实机测试，不判断双方内部实现优劣或给出未经测量的完成率。

## 范围与方法

本次查看了项目根目录组成、原生面板/主进程入口、TS 内核模块、Host/MCP 注册、Creator 命令目录、编辑合同、技能发布清单、打包与凭据实现，以及计划和运行轨迹文档。没有运行新的 Creator 任务或自动测试，也没有逐行审计全部引擎源码。

当前工作区根目录包含 `2.4.15engine/`、`2.4.15NewProject/`、`docs/`、`tools/`、`plugins/`、`vendor/`。`docs/2.x/`、`docs/3.x/` 与 `docs/comparisons/` 各有 12 份主线章节；3.x 研究资料不代表当前产品支持 3.x。工作区没有现成的 `graphify-out/graph.json`，本次按实际代码入口、合同与证据复核，没有新建全仓知识图谱。

状态区分：

- **已有实机证据**：已有记录证明某个明确、受限的 Creator 任务真实执行过，不能推广到所有任务。
- **代码已实现、实机待验**：实现及历史自动测试记录存在，尚缺当前原生面板的端到端证明。
- **部分支持**：只有指定字段、资源类型、脚本类型或运行平台可用。
- **当前不可用/缺少**：无对应执行接口，或当前实现明确报告不可用。

历史文档记录的 runtime 58 项、MCP/扩展 84 项测试是此前批次结果，不代表本次重新测试了 0.3.11。10 月 12 日新增复制/导出有静态检查和部署证据，尚缺真实 Creator 点击及导出文件验收记录。

## 项目已有的六层结构

| 层 | 主要位置 | 已有价值 | 当前边界 |
| --- | --- | --- | --- |
| 引擎研究与测量 | `2.4.15engine/`、`docs/2.x/`、比较章节、probes | 引擎生命周期、资源、渲染、UI、发布、性能的研究基础 | 研究正文/探针不是自动可调用的 Agent 编辑能力 |
| Creator 原生入口 | `2.4.15NewProject/packages/cocos-agent-bridge/` | 面板、工程/选择上下文、模型配置、服务生命周期、审批与回执 | 当前只推进 2.4.15；全局安装和编辑器重载仍有人工步骤 |
| 单 Agent 内核 | `tools/cocos-agent-runtime/src/` | Provider、工具循环、hooks、Todo、压缩、记忆、任务图、目标续跑 | 通用机制已有，复杂真实任务的结果验收仍不足 |
| Host 与 MCP | `tools/cocos-agent-bridge/mcp/` | 模式路由、Plan、状态存储、工具/Resource 读取、恢复与日志 | TS 内核仍使用 JS 技能适配器；新旧 JS/TS 路径并存增加维护面 |
| Creator 内容命令 | `tools/cocos-agent-bridge/`、扩展 `main.js`/`scene.js` | 场景、PNG、Prefab、脚本、构建、预览和身份校验 | 输入白名单很窄；19 项 Creator 语义命令声明中有条件不可用项，目录数量不等于实时可用数量 |
| 产品任务知识 | `plugins/cocos-agent-2x/skills/` | 当前发布清单为 **14 项 skill、31 项引用资源**，正文/引用/包指纹校验 | 偏资源、操作合同与诊断；大量普通游戏功能开发知识尚未产品化 |

产品运行关系为：Creator 面板 → Creator 管理的 Node Host → TS Agent + DeepSeek Provider → MCP/Host 命令 → Creator 扩展/场景脚本 → 编辑器与磁盘回执。它已有自己的技能发布来源，不需要 Codex 的 `.codex/skills/` 或插件缓存。

## 与 Unity 的能力对照

| 方向 | Unity 官方公开能力 | CocosAgent 当前情况 | 主要差距 |
| --- | --- | --- | --- |
| Editor 内独立使用 | 原生 Assistant 面板 | 已有原生面板；Creator 管理 Host/MCP；工程根路径和全局安装已修正 | Node 20+ 外部依赖、安装自检、兼容更新、重载确认和独立工程持续使用验收 |
| Ask / Plan / Agent | 三种模式；计划可反馈修改并批准后执行 | 三种模式已接 TS 内核；计划卡、逐步执行和单次写入审批已有 | Plan 输出稳定性、计划修改/重排/拒绝界面、连续执行体验和失败状态一致性 |
| 项目上下文 | 场景/组件、包、平台/构建设置、Console；可附加对象/文件上下文 | 工程名、活动场景、最多 8 个选中节点、实时快照、PNG 检索和 AGENTS 哈希门槛 | 脚本发现/搜索、跨文件关系、组件到脚本映射、包/构建设置、资源依赖图、手动附件 |
| 项目知识与技能 | 原生技能；官方外部插件另提供多个开发领域的技能 | 原生 14 项技能，按任务读正文/声明引用并校验版本 | UI 布局、事件绑定、网络、存档、动画、音频、物理、SDK 等真实任务知识；同时需要相应执行命令 |
| 脚本开发 | 创建和修改脚本、复杂系统开发/重构 | 已有 JS 读取、唯一文本替换、语法检查、编译产物核对、补偿/对账；按钮有实机证据 | 新建脚本、TypeScript、多个文件协同修改、组件挂接与属性绑定、通用诊断 |
| 场景和 UI | 创建/删除对象、增删组件、更新对象与资源设置 | 空节点、Sprite/Label 创建、受限字段补丁和 PNG 场景编排 | 普通节点删除/换父级/排序、通用组件增删、Widget/Layout/Button/EditBox/ScrollView/Mask、事件与自定义属性；现有 Label 文本不能通过 patch 修改 |
| Prefab | Agent 可创建 Prefab，并修改场景组件 | 创建/实例化有底层实机证据；场景实例可做受限 patch；源 inspect 已实现 | **源 patch 在当前代码下不可用**；保存/退出/重开桥接和源修改实机闭环未完成 |
| 资源工作流 | 资产管理及多种生成器；可选本机 Asset Knowledge 按视觉内容检索 | PNG 导入、Texture/SpriteFrame 身份、资源→场景→release、Bundle、回滚等有专门闭环 | 通用资源检索、字体/音频/动画/图集/材质、视觉语义检索；图像/音频/动画生成也未产品接入 |
| 运行与视觉 | Console 上下文、图片附件、自动截图/标注等 | 预览启动、帧/暂停、有限日志、节点状态、画布截图；Flash 路径支持把图片交给模型 | Windows 默认浏览器发现、认证预览归属、持续观察同一页面、实际输入、完整错误堆栈、原生/小游戏观察与真实错误修复验收 |
| 修改与恢复 | 可撤销操作；文档有 checkpoints 设置 | UUID/hash/before 校验、保存读回、operation 账本、不确定写入锁、补偿/新 ID 重放 | 统一差异审阅、用户友好撤销/检查点、整项任务恢复；不能把逐项补偿称为整工程原子回滚 |
| 权限 | Allow / Ask Permission / Deny 等操作级设置 | Ask/Plan 只读；Agent 每项写入经审批，AGENTS 哈希和技能证据为硬门槛 | 范围明确的权限设置、拒绝/批准状态统一展示、审批负担评估；当前保留逐项授权约束 |
| 连续任务 | 对话与计划管理、工具详情与执行进度 | 会话/计划/运行记录持久化、取消、差异、精确 operation 核对、任务图/记忆/压缩已实现 | Creator 重启恢复、取消中的写入回执、记忆修订、超预算取证、目标续跑的面板实机证明 |
| 模型与体验 | 多模型选择；包更新与工具详情 | DeepSeek Flash/V4 Pro 配置；只有 Flash 有既定图像路径；Markdown、版本、清空、复制、JSON 导出已加 | 多 Provider、流式回复、结构输出保障、用量/费用反馈、完整参数/回执展开和错误重试分类 |
| 构建与性能 | 平台/构建上下文；Assistant 文档列有性能分析入口 | 2.4.15 Web-Mobile 内容构建/读回；Bundle 驻留、引用释放和压力研究较深入 | 普通项目构建/平台覆盖、可重复性能预算任务；历史性能探针不能等同于通用原生 Profiler 助手 |

Unity 三模式、上下文和执行说明见[官方模式介绍](https://unity.com/blog/unity-ai-assistant-ask-plan-agent-mode-explained)与[模式手册](https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.10/manual/about/assistant-modes.html)。计划修订见[Plan 手册](https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.10/manual/about/assistant-plan-mode.html)。对象/组件工具的范围见[工具手册](https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.10/manual/assets/assistant-tools.html)。

权限、checkpoints、Asset Knowledge 和更新设置见[偏好手册](https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.10/manual/reference/preference.html)；图片附件与自动截图见[图像手册](https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.10/manual/automate/image-support.html)。生成器和性能入口见[Assistant 总览](https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.10/manual/index.html)。多模型及外部 CLI/MCP/插件见[Unity 当前产品页](https://unity.com/features/ai)和[外部插件手册](https://docs.unity.com/en-us/ai/unity-plugin/about-unity-plugin)。外部插件技能不可直接当作全部内置原生技能。

## 当前代码中需要优先处理的问题

### 1. Plan 校验失败仍沿用 completed 状态

[assistant-host.mjs](F:/github/CocosAgent/tools/cocos-agent-bridge/mcp/assistant-host.mjs:603) 在 `parseStructuredPlan` 失败时只替换解释文本，随后仍以 `result.status` 保存运行和回复面板。若内核返回 completed，面板就会同时显示“计划没有通过结构校验”和“已完成”。这与用户截图一致，当前代码仍有这条路径。

应将“模型调用结束”“合法计划生成”“任务已完成”作为不同结果处理；结构校验失败必须成为明确失败，不能生成完成卡。Plan 还需要有界的结构修正/重新生成流程。现有解析器能处理部分引号问题，不能修正普通英文散文等完全不符合结构的响应。

**同日后续修正（0.3.12）：** Host 已将非法 JSON、结构/工具校验失败统一转换为 `failed / plan-validation-failed`，缺少成功预检回执转换为 `failed / plan-preflight-missing`；会话持久记录、面板回执与导出的任务状态使用同一修正结果。合法计划的历史卡显示“计划已生成”，失败显示“计划生成失败”，取消/停止/模型失败保留原状态。针对结构校验、Host 结果、存储恢复和面板标题的 22 项相关回归测试全部通过；当前 Creator 重载后的实机复测仍待进行。本次没有增加模型自动修正/重新生成。

### 2. 自由任务验收条件过弱

[creator-host-adapter.ts](F:/github/CocosAgent/tools/cocos-agent-runtime/src/creator-host-adapter.ts:215) 对未传入显式 `goalCriteria` 的 Agent 任务，默认采用 `requiredTools: ['*']`，即一条成功且已解决的 task 回执。[task-system.ts](F:/github/CocosAgent/tools/cocos-agent-runtime/src/task-system.ts:264) 的通配条件接受 task 角色的成功回执，因此只读场景工具也可能满足默认条件。

这能防止“完全没有工具就宣称执行”，但不能证明一个复合游戏功能已做好。已批准 Plan 步骤会传入更明确的 requiredTools；仍应把参数、目标身份、实际产物、运行预期和未完成恢复状态纳入任务验收，不能仅靠工具名字出现次数。

**同日后续修正（0.3.13）：** 自由任务已移除通用成功回执默认门槛，新增 Host 定义的内容写入、账本、最终目标读回及必要的编译/运行条件，持久化与无持久化路径均执行。读取场景不能完成“创建网络连接弹窗”；缺少实际交互验收时保持未完成，面板/持久记录展示缺项。范围识别是保守的有界分类，不代表任意功能语义已可自动验收；原生交互验证仍未实现。见[自由任务验收合同](F:/github/CocosAgent/docs/agent-foundation/cocos-agent-free-task-acceptance-0.1.md)。

### 3. Prefab skill 已有，源编辑执行入口仍不可用

[main.js](F:/github/CocosAgent/2.4.15NewProject/packages/cocos-agent-bridge/main.js:726) 的 `prefabEditModeModule()` 当前固定返回 null。目录生成时 `prefabSourcePatchApiReady` 为 false，因此活动场景打开时，`prefab.source.patch` 仍会报告 `PREFAB_EDIT_MODE_API_UNAVAILABLE`。源 inspect 有独立的 AssetDB 可用性条件，不应与写入一起描述为全部缺失。

新增 `cocos2-prefab-workflows` 已正确区分创建、实例化、场景实例补丁与源编辑；还需要补齐 Creator 2.4.15 实际可工作的进入/保存/退出/重开桥接并验收。直接修改 `.prefab` JSON 或只改单个场景实例，不能替代源编辑闭环。

### 4. Windows 运行观察存在默认安装缺口

[runtime-observation.js](F:/github/CocosAgent/tools/cocos-agent-bridge/runtime-observation.js:9) 默认只列 macOS Chrome/Chromium 路径。Windows 可通过 `COCOS_AGENT_CHROME_PATH` 手动配置，但未配置时即使安装了 Chrome，也可能得到 `CHROME_NOT_FOUND`。

此外观察器固定访问 7456，每次启动独立临时页面。它能验证初始状态，不能读回用户正在点击的另一个页面；场景 UUID 前后核对已有，但共享端口的运行实例归属尚未认证。需要为真实运行会话补身份、持续观察和有界输入能力。

### 5. 脚本和 UI 合同限制了普通功能开发

[script-contract.js](F:/github/CocosAgent/tools/cocos-agent-bridge/script-contract.js:9) 只接受 assets 下已有 `.js`，64 KiB 上限，最多 8 个唯一文本替换；没有新文件/TS/跨文件任务合同。

[scene.js](F:/github/CocosAgent/2.4.15NewProject/packages/cocos-agent-bridge/scene.js:474) 的创建组件白名单只有 Sprite/Label。[scene-patch-contract.js](F:/github/CocosAgent/tools/cocos-agent-bridge/scene-patch-contract.js:6) 只开放少量字段，Label 文本、Button 事件、自定义组件属性、布局关系等均未开放。

因此“制作 GUI/网络连接弹窗”会同时碰到控件创建、布局、脚本创建/挂接、属性绑定、网络逻辑和运行输入验证缺口。应围绕一个可逆的真实弹窗任务逐项扩展命令，再补配套 skill。

### 6. 部分界面文案与实现不一致

[credential-store.cjs](F:/github/CocosAgent/2.4.15NewProject/packages/cocos-agent-bridge/credential-store.cjs:65) 使用用户目录 `credentials.env` 存储凭据，并未接入系统密钥链加密。面板存在“正在恢复本机加密凭据”的提示，应改为与实际存储方式一致的文案。此复核只查看凭据代码，没有读取实际凭据内容。

[deepseek-provider.ts](F:/github/CocosAgent/tools/cocos-agent-runtime/src/deepseek-provider.ts:121) 使用 `stream: false`。当前“正在处理”状态不能提供回复流或模型用量信息；这是可感知的体验差距。

## 已有实机成果必须保留的边界

| 成果 | 已证明 | 不能据此宣称 |
| --- | --- | --- |
| 指定 PNG 原生任务 | 挂接、保存/重开、读回、Web 可见、补偿、新 ID 重放；最终演示节点保留 | 任意资源类型或所有 TS Agent 写入都完成验收 |
| 原生 TS Agent | 读取技能/合同和完整场景；一次批准后的精确场景补偿与读回 | 任意脚本、多步 UI 开发、原生重放和运行错误修复已可靠 |
| 按钮脚本 | 现有 JS 修改/编译/对账/补偿；外部可见页面实际点击和恢复后行为 | 原生 Agent 自己完成了点击验收，或 ledger runtime 已自动通过 |
| 普通预览观察 | 初始同场景 UUID、帧推进、Label、日志和画布截图 | 同一可见点击页面的持续观察、故障注入/修复闭环、多实例端口认证 |
| 内容/Bundle/性能 | PNG/Web-Mobile 专用工作流、多次释放/驻留等测量 | 所有平台、任意 Bundle 部署或通用性能修复 |
| 记忆/压缩/任务图/取消 | 代码和历史自动测试覆盖 | 当前 Creator 面板跨重启、取消、候选记忆审阅和缺项续跑都已实机通过 |

依据：[原生 Agent 计划](F:/github/CocosAgent/docs/agent-foundation/cocos-agent-real-project-development-plan.md)、[脚本合同与按钮证据](F:/github/CocosAgent/docs/agent-foundation/cocos-agent-script-development-0.1.md)、[运行观察合同](F:/github/CocosAgent/docs/agent-foundation/cocos-agent-runtime-observation-0.1.md)、[Prefab 源编辑合同](F:/github/CocosAgent/docs/agent-foundation/prefab-source-edit-0.1.md)、[TS 机制映射](F:/github/CocosAgent/tools/cocos-agent-runtime/PORTING-MAP.md)。

## 建议推进顺序

| 优先级 | 工作 | 完成依据 |
| --- | --- | --- |
| P0 | 修正 Plan 失败状态与自由任务验收门槛 | 非法计划明确失败；“读到场景”不会把创建功能判为成功；未完成验证明确列出 |
| P0 | 在 mergeClient 收口现有面板/全局安装/日志闭环 | 关闭 Codex 后能问答；清空后可输入；逐条复制和导出文件真实可用；更新/重载后版本与实时能力一致 |
| P1 | 修复 Prefab 源编辑桥接 | 同一已有 Prefab 的 inspect、批准修改、保存、退出、重开、磁盘读回、补偿真实通过 |
| P1 | 建立真实工程上下文检索 | 可发现相关脚本/组件/资源，不要求用户先给所有精确路径；能解释功能涉及哪些对象和文件 |
| P1 | 用一个真实 UI 功能扩展脚本与组件合同 | 从发现对象、可审阅差异、创建/修改、绑定、编译到实际交互验证，全部有当前工程证据 |
| P1 | 运行观察形成同一会话闭环 | Windows 浏览器自动发现，场景/实例归属确认；实际输入后读回；一次真实故障注入→诊断→批准修复→二次观察→恢复 |
| P2 | 收口持久化和长任务能力 | Host/Creator 重启、取消中的写入、记忆纠正/删除、超预算结果取回、目标未满足续跑真实通过 |
| P2 | 改进计划修改、工具详情、差异和恢复体验 | 可读参数与完整回执；计划可反馈修改；停止原因、已发生副作用与可执行恢复建议清楚一致 |
| P3 | 扩展模型、技能领域与资源类型 | 由实际游戏任务触发；对 Provider、能力可用性和预算有明确验证 |

Node 自检/运行时打包、统一版本显示、系统凭据存储和性能数据管理可随上述真实使用阻塞推进。生成器、通用引擎 Profiler、外部生态扩张放在核心任务闭环之后。

产品明确排除的通用 shell、子 Agent/团队、定时任务不列为必补缺口。3.x 暂停新增是现行范围决定，当前应先把 2.4.15 做成可重复使用的产品。

值得保留的基础是：独立 Creator 生命周期、产品技能来源、严格身份与陈旧状态检查、真实磁盘/编辑器读回、不确定写入恢复约束，以及资源/Bundle 的已有测量资料。Unity 未公开的内部记忆、上下文压缩或事务实现不作猜测；也不能从这些基础直接得出 CocosAgent 已比 Unity 更安全或更可靠。

## 第 3 项后续修复：Prefab 场景桥接（0.3.14）

主进程固定返回 `null` 的 `prefabEditModeModule()` 已移除。模式查询、保存和退出改由场景脚本调用 `scene://edit-mode`；能力目录使用场景端探测结果。每个入口重验模式与 Prefab UUID，退出等待回执和 `scene:ready` 并核对原场景 UUID；保存仍要求回调、`scene:saved`、磁盘和重开读回，保留修改后不确定结果的恢复限制。SpriteFrame 异步加载后还会重验节点前值。没有改变字段白名单。

这是编辑器桥接实现修复；真实 2.4.15 Prefab 多轮修改、保存/重开、补偿和重放仍待验收。安装包中存在场景编辑模式模块不能替代此验收。详见 [Prefab 源编辑合同](F:/github/CocosAgent/docs/agent-foundation/prefab-source-edit-0.1.md)。

## 第 4 项后续修复：Windows 浏览器发现与固定页面（0.3.15）

新增 Windows Chrome 常见安装目录、App Paths 注册表及 PATH 发现，支持 Edge 回退和显式路径覆盖。原生 MCP Host 改用按规范工程路径隔离、绑定 Creator 实例和场景的可见预览会话；后续观察复用原页面，返回会话/页面 ID、页面代次和观察序号，并保留两次观察之间的日志。用户应在标题为 `CocosAgent 预览 · <scene>` 的专用窗口操作，普通浏览器页不会自动被接管。

内容写入在调度前使旧预览失效，批准 `runtime.preview.start` 后才刷新并继续观察；关闭、断连或实例/场景变化不会偷偷换页。当前页面累计错误在刷新前保留，不能凭后一次没有新错误把旧错误判为修好。截图前后及 Creator 上下文均核对身份，Host 关闭时只清理自身浏览器与私有临时配置。

这是实现更新，真实 Windows 同页点击/读回、关闭恢复、写后刷新和错误修复仍待 Creator 实机验收。未增加自动输入或交互结果断言；共享预览端口 7456 的实例归属仍未得到运行时认证。见 [运行观察合同](F:/github/CocosAgent/docs/agent-foundation/cocos-agent-runtime-observation-0.1.md)。
