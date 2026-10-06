# Cocos Creator 2.x 与 3.x 源码研究计划

## 目标与范围

系统理解 Cocos Creator 2.4.15 和 3.8.7 的源码架构，在研究过程中把经过验证的源码能力逐步制作成 skill，为后续设计 Cocos agent 建立可核查、可复用的基础。本计划不以版本迁移为目标，也不预先认定两代引擎采用相同的内部设计。

研究对象是本工作区的四个目录：

| 版本 | 引擎源码 | 示例工程 |
| --- | --- | --- |
| 2.x | `2.4.15engine/` | `2.4.15NewProject/` |
| 3.x | `3.8.7engine/` | `3.8,7NewProject/`（目录名含逗号） |

引擎运行时、编辑器集成代码、Creator 编辑器本体是不同的研究对象。先确认当前源码对每一项能力的覆盖程度；遇到仓库没有提供的实现，应标明边界，不用推测补全。

## 官方文档基准

本研究以对应版本的官网用户手册为主纲，而不是从源码目录结构倒推开发者概念：

| 源码快照 | 主要文档 | 使用范围 |
| --- | --- | --- |
| 2.4.15 | [Cocos Creator 2.4 中文用户手册](https://docs.cocos.com/creator/2.4/manual/zh/) | 2.x 的术语、公开用法、编辑器工作流和功能边界。 |
| 3.8.7 | [Cocos Creator 3.8 中文用户手册](https://docs.cocos.com/creator/3.8/manual/zh/) | 3.x 的术语、公开用法、编辑器工作流和功能边界。 |

两份手册按 2.4、3.8 系列编写，本地源码是各自系列中的具体补丁版本。每个专题先读该版本手册的直接相关页面；涉及精确 API 签名时再核对手册所链接的同版本官方 API 参考。手册决定研究问题和开发者行为的表述，本地源码用于回答内部如何实现，示例、测试与对应版本编辑器预览用于验证行为。文档未公开的宿主接线、调用时序或内部约束不得仅凭手册推断；源码与手册不一致时如实记录版本、运行条件和证据。

官网目录给出的主线是场景制作、资源、脚本与事件、跨平台发布，以及渲染、UI、动画、音频、物理等功能模块。以下专题入口用于建立索引，进入实际阶段时还要继续阅读其下的具体页面：

| 专题 | 2.4 手册入口 | 3.8 手册入口 |
| --- | --- | --- |
| 场景、节点、组件 | [场景制作工作流程](https://docs.cocos.com/creator/2.4/manual/zh/content-workflow/index.html) | [场景制作](https://docs.cocos.com/creator/3.8/manual/zh/concepts/scene/index.html) |
| 资源与加载 | [资源工作流程](https://docs.cocos.com/creator/2.4/manual/zh/asset-workflow/index.html)、[Asset Manager](https://docs.cocos.com/creator/2.4/manual/zh/asset-manager/index.html) | [资源系统](https://docs.cocos.com/creator/3.8/manual/zh/asset/index.html)、[Asset Manager](https://docs.cocos.com/creator/3.8/manual/zh/asset/asset-manager.html) |
| 脚本、生命周期、事件 | [脚本开发指南](https://docs.cocos.com/creator/2.4/manual/zh/scripting/index.html) | [脚本指南及事件机制](https://docs.cocos.com/creator/3.8/manual/zh/scripting/index.html) |
| 渲染与 UI | [图像和渲染](https://docs.cocos.com/creator/2.4/manual/zh/render/index.html)、[UI 系统](https://docs.cocos.com/creator/2.4/manual/zh/ui/index.html) | [图形渲染](https://docs.cocos.com/creator/3.8/manual/zh/module-map/graphics.html)、[2D 渲染](https://docs.cocos.com/creator/3.8/manual/zh/2d-object/2d-render/index.html)、[UI 系统](https://docs.cocos.com/creator/3.8/manual/zh/2d-object/ui-system/index.html) |
| 动画与物理 | [动画系统](https://docs.cocos.com/creator/2.4/manual/zh/animation/index.html)、[物理与碰撞](https://docs.cocos.com/creator/2.4/manual/zh/physics/index.html) | [动画系统](https://docs.cocos.com/creator/3.8/manual/zh/animation/index.html)、[物理系统](https://docs.cocos.com/creator/3.8/manual/zh/physics/index.html) |
| 音频、粒子、缓动 | [音乐和音效](https://docs.cocos.com/creator/2.4/manual/zh/audio/index.html)、[粒子组件](https://docs.cocos.com/creator/2.4/manual/zh/components/particle-system.html)、[缓动](https://docs.cocos.com/creator/2.4/manual/zh/scripting/tween.html) | [音频](https://docs.cocos.com/creator/3.8/manual/zh/audio-system/overview.html)、[粒子](https://docs.cocos.com/creator/3.8/manual/zh/particle-system/index.html)、[缓动](https://docs.cocos.com/creator/3.8/manual/zh/tween/index.html) |
| 发布、原生与扩展 | [跨平台发布](https://docs.cocos.com/creator/2.4/manual/zh/publish/index.html)、[扩展编辑器](https://docs.cocos.com/creator/2.4/manual/zh/extension/index.html)、[引擎定制](https://docs.cocos.com/creator/2.4/manual/zh/advanced-topics/engine-customization.html) | [跨平台发布](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/index.html)、[原生开发](https://docs.cocos.com/creator/3.8/manual/zh/native/overview.html)、[扩展编辑器](https://docs.cocos.com/creator/3.8/manual/zh/editor/extension/readme.html) |

版本专属主题要单独列入覆盖清单。例如，2.4 手册有动作系统、对象池和 `cc.Class`；3.8 手册有装饰器、程序式动画、可定制渲染管线、地形和角色控制器。它们可以说明各自版本的能力，不为比较而强找对等实现。升级指南只在理解历史设计或术语来源时使用，本研究没有迁移目标。

## 三条研究线

### A. 独立理解 2.x

从 2.4 手册描述的开发者行为出发，向下追踪 2.x 的入口、核心对象、数据结构、调用链和平台实现。以 `2.4.15engine/` 为内部实现证据，`2.4.15NewProject/` 用于观察和验证。形成一份可以单独阅读的 2.x 架构说明，不借用 3.x 的术语来解释它。

### B. 独立理解 3.x

用同样的研究问题，从 3.8 手册描述的行为和 3.x 自身的模块划分、执行路径出发。以 `3.8.7engine/` 为内部实现证据，`3.8,7NewProject/` 用于观察和验证。分别理清 TypeScript 运行时、原生 C++、平台适配和构建链路之间的关系。形成一份可以单独阅读的 3.x 架构说明。

### C. 相同行为的实现对照

在 A、B 各自形成可核查结论后，再对照同一个开发行为在两代源码中的实现。比较入口、对象关系、数据流、生命周期、职责边界、平台差异和可验证结果。对照的目的是理解设计选择及其影响，不给两代实现强行建立一一对应的类名映射。

## 研究顺序

每一阶段按「对应版本手册中的开发者行为 → 2.x 独立源码分析与验证 → 3.x 独立源码分析与验证 → 相同行为对照 → 提炼并验证 skill」推进。先完成手册目录覆盖清单，再根据依赖安排深入顺序；阶段编号是研究队列，不代替官方章节。具体顺序可在阅读后调整，但要记录原因。

| 阶段 | 官网主题与核心问题 | 同一行为的验证切口 |
| --- | --- | --- |
| 1. 项目与启动 | 项目结构、预览调试、构建入口；引擎如何注册模块并启动游戏，编辑器与运行时的边界在哪里？ | 启动一个空场景，追踪从入口到首帧的路径。 |
| 2. 场景对象 | 场景制作、节点、组件、预制资源、坐标与层级；对象如何表示、创建、激活和销毁？ | 实例化预制体、挂载组件并销毁节点。 |
| 3. 脚本与执行时序 | 组件脚本、声明方式、生命周期、执行顺序、计时器和帧调度；回调与事件队列如何接入主循环？ | 在多个节点上记录激活、定时、更新和销毁顺序。 |
| 4. 资源系统 | 导入、`.meta`、序列化、场景切换、Asset Manager、Bundle、缓存和释放；资源身份与引用由谁维护？ | 动态加载预制体及贴图，切换场景后检查引用与释放。 |
| 5. 输入与事件 | 手册中的输入事件、节点事件、系统事件各经由什么路径派发，坐标和命中检测如何工作？ | 点击或触摸节点，追踪平台输入到组件回调。 |
| 6. 图形渲染 | 图像/2D 渲染、3D 对象、相机、材质、Effect、光照与管线；场景数据如何转为绘制命令？ | 显示带材质对象，改变变换或材质并追踪至渲染端。 |
| 7. UI 系统 | Canvas、布局、适配、文本和交互组件如何组织、更新与绘制？ | 修改分辨率并点击动态列表项，观察布局和事件。 |
| 8. 动画与表现 | 动画、缓动、音频、粒子分别如何驱动对象和资源？另记 2.4 动作系统与 3.8 程序式动画等版本专属能力。 | 播放动画与音效，追踪状态、时间轴及资源生命周期。 |
| 9. 物理与空间 | 2D/3D 物理、碰撞、查询、同步和后端选择如何实现？ | 创建刚体与碰撞体，追踪一次碰撞回调。 |
| 10. 发布与原生 | Web、小游戏、原生发布、平台适配、JSB 与脚本/原生协作的边界在哪里？ | 对同一场景行为追踪 Web 与原生分叉点。 |
| 11. 辅助能力 | 网络、持久化、本地化、热更新和平台 SDK 等官方专题分别由哪些层提供？ | 选取可在本机验证的最小案例，标出系统与平台服务边界。 |
| 12. 编辑器扩展与工程诊断 | 扩展编辑器、引擎定制、构建模板、测试、调试和性能工具由哪些仓库代码支持？ | 定位并验证一个小型引擎或构建问题的完整流程。 |

官网的专题范围大于本地两个最小示例。每阶段先列出对应版本手册的子主题，标记研究进度、源码覆盖与待验证问题；先建立索引的专题仍保留在后续深入研究队列中。2.4 与 3.8 的能力清单分别维护。3.8 地形、可定制渲染管线、程序式动画、角色控制器，以及 2.4 动作系统、对象池等进入对应阶段的版本专属清单。手册有功能不代表四个本地目录都包含其完整编辑器实现。

示例工程只承担可运行观察点的角色。某个行为如果示例不具备，应先设计最小验证场景，再决定是否修改示例；内部实现结论以对应补丁版本的源码为证据，并与手册公开行为核对。

## 每个主题的研究方法

1. **建立手册基线。** 分别记录 2.4、3.8 官方专题页链接、开发者操作、公开 API、预期现象、运行平台与手册明确写出的约束。遇到精确签名再看同版本官方 API 参考；不把升级指南当作本研究的目标。
2. **画出边界。** 从手册行为定位本地源码，标明 API 入口、核心模块、编辑器侧与运行时侧、JavaScript/TypeScript 与 C++ 的分界；仓库缺少的实现单列。
3. **追踪调用链。** 从入口到可观察结果记录关键函数、状态变化与返回路径；异步和事件驱动路径单独标出。
4. **确认规则。** 记录对象所有权、生命周期、资源引用、缓存、线程或时序等约束，以及源码如何维护这些约束。对照手册叙述，记录符合、补充或冲突及其适用条件。
5. **做最小验证。** 优先利用现有测试和示例；必要时设计聚焦的实验，记录 Creator 补丁版本、平台、配置和结果。无法运行时明确说明证据仅来自静态阅读。
6. **形成独立结论。** 先分别完成 2.x 与 3.x 的说明，再填写相同行为的对照，区分手册声明、源码事实、实验观察和推断。没有同一行为的版本专属能力只写独立结论。

每条关键结论至少指向该版本的具体官方手册页，以及具体源码路径与符号；若手册没有覆盖内部机制，要明确写「手册未说明」。复杂调用链记录起点、关键跳转和终点。引用行号时以当时的源码快照为准，避免后续文件变化造成误导。

## 同步制作 skill

skill 是让 agent 完成一类具体任务的操作方法，不能只是架构笔记的复制。每完成一个主题，就检查是否已经掌握了可复用、可验证的能力；满足条件时立即制作候选 skill，不等整个源码研究结束。

按以下流程循环：

1. **选定任务。** 用开发者实际会提出的请求描述 skill 的用途，例如定位组件生命周期问题、追踪资源释放、解释一次渲染状态更新。
2. **限定版本与边界。** 2.x 和 3.x 分别制作；只有两边流程都经过验证，且共同步骤确实稳定时，才制作跨版本的路由或对照 skill。明确对应官方手册入口、补丁版本、可读取或修改的对象，以及编辑器源码缺失等限制。
3. **写成可执行流程。** 包括触发条件、版本识别、先查对应手册的步骤、源码检索入口、调用链追踪步骤、必须检查的不变量、验证方式、失败时如何缩小问题，以及期望的输出证据。详细源码地图放在引用材料中，避免把整份研究笔记塞进操作指令。
4. **用真实任务检验。** 至少用一个正常案例和一个易混淆或证据不足的案例试用，核对版本选择、官方用法、源码定位、结论依据和验证结果；发现误导性步骤就修订。
5. **关联与维护。** 记录 skill 所依赖的主题笔记、源码版本和验证案例。后续源码结论变化时，同时检查受影响的 skill。

候选能力可随研究逐步产生，例如 2.x/3.x 各自的启动链路追踪、节点生命周期定位、资源引用与释放分析、渲染路径追踪、平台实现定位。这里列的是候选任务，不代表这些能力已经研究或验证完成。skill 的最终安装位置和调用形式待 Cocos agent 的运行环境确定；研究阶段先保留可审查的源文件和验证记录。

## 阶段产物与完成标准

计划文档保存在 `docs/`。后续研究产物可按以下结构逐步创建，当前不预填尚未验证的架构结论：

```text
docs/
  source-study-plan.md
  2.x/                 # 独立的 2.x 架构与主题笔记
  3.x/                 # 独立的 3.x 架构与主题笔记
  comparisons/         # 按同一行为组织的对照
  agent-foundation/    # 从已验证源码知识提炼的 agent 设计依据
    skills/            # 候选 skill 与验证记录，非最终安装目录
```

一个主题完成时，应能交付：

- 独立的 2.x 和 3.x 模块地图，说明职责、边界及与相邻模块的关系。
- 各自的官网专题页索引、公开行为摘要及与本地源码覆盖范围的对照；未覆盖之处明确标记。
- 各自至少一条从开发者操作到运行结果的完整调用链，并注明关键状态与不变量。
- 对照表或时序图，明确相同点、不同点，以及无法直接对应的部分。
- 证据索引：对应版本官方手册的具体页面、源码符号和路径、现有测试或示例、运行验证结果；手册与源码的差异及未解决问题单列。
- 面向游戏开发者的解释：这些设计如何影响使用 API、调试、性能和扩展。
- 对该主题是否能制作 skill 的判断；能制作时附候选 skill、适用版本、引用资料和试用结果，暂不能制作时记录欠缺的证据。

只找到同名 API 或列出目录，不算完成。发现与最初判断冲突的证据时，修订结论并保留变更原因。

## 为 Cocos agent 积累的设计依据

源码研究同时记录未来 agent 真正需要的知识，而不急于决定 agent 的产品形态：

- **可定位：** 开发者描述一个现象时，应从哪些入口、模块、符号和日志开始查找。
- **可解释：** agent 能否给出带源码证据的调用链，并把确定事实与推断分开。
- **可修改：** 哪些文件是源文件，哪些是生成物；修改组件、资源、场景或原生代码需要维护哪些约束。
- **可验证：** 某类改动应运行哪些测试、构建或编辑器预览；结果能覆盖什么，不能覆盖什么。
- **有边界：** 哪些能力属于引擎源码，哪些需要 Creator 编辑器实现或其他资料；证据不足时应如何表述。

skill 在研究过程中逐步积累；等两代架构和行为对照积累到足够程度，再结合已验证的 skill 与真实任务，确定 agent 的能力范围、工具接口、知识索引与评测用例。研究记录是设计输入，不直接当作 agent 的最终提示词。

## 当前进度

- 阶段 1 已完成引擎源码静态追踪、两套编辑器预览宿主脚本接线核对与初始化/首帧事件打点：[2.x](2.x/01-startup-and-frame.md)、[3.x](3.x/01-startup-and-frame.md)、[对照](comparisons/01-startup-and-frame.md)；三条路径的图见[阶段 1 流程图](diagrams/01-startup-and-frame.md)。原始运行记录保存在 `docs/agent-foundation/traces/`。
- 已制作并修订两份启动链路 skill 草案，案例验证见 `docs/agent-foundation/skills/startup-validation.md`。
- 两个示例已在对应编辑器中打开，并通过浏览器预览成功显示各自场景；关键引擎文件与编辑器附带版本的哈希一致。阶段 1 的结论限于当前源码、构建模板与这两次编辑器浏览器预览；其他平台宿主仍按后续阶段分别研究。
- 阶段 2 已分别完成节点、组件、场景和预制体对象结构及“实例化 → 挂组件 → 入场 → 激活/反激活 → 销毁”调用链：`docs/2.x/02-objects-and-scenes.md`、`docs/3.x/02-objects-and-scenes.md`、`docs/comparisons/02-objects-and-scenes.md`。两套编辑器浏览器预览的最小实验记录在 `docs/agent-foundation/traces/`。
- 已制作两份对象生命周期 skill 草案，试用结果见 `docs/agent-foundation/skills/object-scene-validation.md`。组件每帧调度、资产序列化/释放和原生对象桥接仍按阶段 3、4、10 单独研究。
- 已以 2.4、3.8 官网手册修订研究主纲与工作指引。阶段 1 的两份独立笔记、对照和启动 skill 已补做官网校准：项目结构、浏览器预览条件、公开场景 API 与预览宿主的界限均已记录；手册未公开的事件时序仍以源码和打点为证据，未扩展到其他平台。
- 阶段 2 的两份独立笔记、对照、对象生命周期 skill 与验证记录也已补做官网校准：节点活动状态、克隆入场、生命周期与延迟销毁对应手册公开行为；2.4 预制体同步、3.8 预制件覆盖及两版 `removeFromParent` 用法已分别记录。编辑器预制件保存流程和跨场景常驻节点尚无运行实验，保持源码或手册证据边界。
- 阶段 3 已按两版官网手册分别完成脚本声明、生命周期批处理、组件每帧队列与计时器调度研究：[2.x](2.x/03-scripts-and-scheduling.md)、[3.x](3.x/03-scripts-and-scheduling.md)、[相同行为对照](comparisons/03-scripts-and-scheduling.md)。两套编辑器 Chrome 预览已用内存组件测量优先级、零延迟计时器、销毁以及帧中新增组件的回调顺序，原始转录见 `docs/agent-foundation/traces/`。
- 已制作两份脚本时序候选 skill，并以正常和易混淆案例试用，见[验证记录](agent-foundation/skills/script-timing-validation.md)。这些结论限于本地补丁版本源码和编辑器浏览器预览；编辑器属性检查器手动排序、项目脚本编译/热重载及其他运行平台仍需按问题单独验证。
- 阶段 4 已按两版官网手册建立资源工作流、动态加载、Asset Manager、Bundle、预加载与释放的公开行为基线；完成 [2.x](2.x/04-assets-and-loading.md)、[3.x](3.x/04-assets-and-loading.md) 的独立源码/示例身份追踪及[相同行为对照](comparisons/04-assets-and-loading.md)。已识别主/子资源 UUID、两条加载管线、依赖填充、引用计数、场景切换与强制释放的实现边界。
- 已制作两份版本专属[资源生命周期诊断 skill 草案](agent-foundation/skills/asset-lifecycle-validation.md)，完成正常和易混淆案例的文件/源码级试用与格式校验。两套 Creator Chrome 预览已分别测得[2.x 场景预加载/SceneAsset/内存资源释放](agent-foundation/traces/2.4.15-asset-lifecycle.jsonl)与[3.x 真实预制体预加载、加载、缓存和引用释放](agent-foundation/traces/3.8.7-asset-lifecycle.jsonl)；回调净引用数与初步源码表述不同，独立笔记和 skill 已据此修订。隔离测试与 Director 内存 Scene 切换分别验证两版 `autoReleaseAssets` 分支、强制释放及常驻节点资源转移。
- 阶段 4 进一步按[分面验证矩阵](agent-foundation/asset-validation-matrix.md)独立核对真实磁盘场景依赖、编辑器导入、普通 JSON 的冷缓存加载/释放，以及各自 Mac 原生包构建与场景显示；两套示例均保留 `resources/stage4-probe.json` 及编辑器生成的 `.meta` 供复测。追加的[2.x](agent-foundation/traces/2.4.15-mac-native-asset-lifecycle.jsonl)和[3.x](agent-foundation/traces/3.8.7-mac-native-asset-lifecycle.jsonl) Mac 进程打点已测得 JSON 的加载回调、缓存身份、净引用、非强制保护与 `decRef` 后释放。随后各自在对应编辑器创建第二个磁盘场景，Chrome 预览的[2.x](agent-foundation/traces/2.4.15-disk-scene-switch.jsonl)与[3.x](agent-foundation/traces/3.8.7-disk-scene-switch.jsonl)，以及 Mac 原生进程的[2.x](agent-foundation/traces/2.4.15-mac-native-disk-scene-switch.jsonl)与[3.x](agent-foundation/traces/3.8.7-mac-native-disk-scene-switch.jsonl)真实 `loadScene` 切换均测得：旧场景独有资源在默认 `autoReleaseAssets=false` 时降至零引用但仍缓存；运行时把旧 Scene 设为 `true` 后，回调时仍缓存，延迟采样已移出缓存并失效。底层平台下载实现与 Android/iOS 仍待研究；Mac 的 JSON 和场景资源探针不能代表全部资源类型。
- 阶段 5 输入与事件已完成桌面 Web 闭环：先按各自官网手册和源码分别梳理 2.4 `CCInputManager → CCEventManager → CCNode`、3.8 `PAL InputSource → Input → PointerEventDispatcher/NodeEventProcessor`，再用两套示例的实际预览验证默认吞噬、父子捕获/冒泡、出界取消和坐标。独立笔记与相同行为比较见 [2.x](2.x/05-input-and-events.md)、[3.x](3.x/05-input-and-events.md)、[比较](comparisons/05-input-and-events.md)；[2.4 初次](agent-foundation/traces/2.4.15-input-events.jsonl)、[3.8 初次](agent-foundation/traces/3.8.7-input-events.jsonl)、[2.4 收口](agent-foundation/traces/2.4.15-input-events-completion.jsonl)与[3.8 收口](agent-foundation/traces/3.8.7-input-events-completion.jsonl)轨迹还覆盖穿透、全局入口和自定义事件。关键差异：2.4 普通自定义类型忽略 `useCapture`，3.8 可捕获；2.4 穿透只以内部 `_touchListener` 实验说明，3.8 采用手册公开的 `preventSwallow`。两份版本专属 skill 与[验证记录](agent-foundation/skills/input-event-validation.md)已同步。探针只在页面内存中运行，测试后重载两页；Native/小游戏桥及帧时序归阶段 10，3D raycast 归阶段 9。
- 阶段 6 图形渲染已完成两套现有示例的桌面 Web 代表路径：以各自官网渲染、相机、材质手册为公开行为基线，分别追踪 2.4 Hello World 的 Sprite/RenderFlow/ModelBatcher/ForwardRenderer 与 3.8 3D 模型的 MeshRenderer/RenderScene/Builtin WebPipeline/RenderGraph/GFX 命令提交。独立研究见 [2.x](2.x/06-graphics-rendering.md)、[3.x](3.x/06-graphics-rendering.md)，[同一行为对照](comparisons/06-graphics-rendering.md)明确对象和材质所有权差异。两版预览均临时移动对象并更换材质，记录[2.4 轨迹](agent-foundation/traces/2.4.15-graphics-rendering.jsonl)、[3.8 轨迹](agent-foundation/traces/3.8.7-graphics-rendering.jsonl)；已形成两份版本专属渲染追踪 skill 和[验证记录](agent-foundation/skills/graphics-rendering-validation.md)。场景级 draw call 不用于单对象归因或跨版本性能结论；2.4 3D、3.8 2D/UI 的细节、逐 Pass 光照/阴影、其他管线与原生后端仍按对应专题继续深入。
- 阶段 7 UI 系统进行中：已按两版官网 Canvas、适配、Widget、Layout、Label、Button、ScrollView 页面建立[2.x](2.x/07-ui-system.md)、[3.x](3.x/07-ui-system.md)独立源码路径与[同一行为对照](comparisons/07-ui-system.md)。两版 Web 预览均记录三项→四项→空列表的 Layout 状态：[2.4](agent-foundation/traces/2.4.15-ui-system.jsonl)清空并调用 `updateLayout()` 后仍保留 300×266 尺寸且标脏，[3.8](agent-foundation/traces/3.8.7-ui-system.jsonl)空容器高 10。两版直接改 View 分辨率均测到 1280×720、scale=1.5；2.4 Canvas/背景未跟随，3.8 四边拉伸 Widget 先标脏、下一帧再对齐 Canvas UITransform。新增隔离 Web 预览的[2.4 ScrollView 轨迹](agent-foundation/traces/2.4.15-scrollview-web.jsonl)与[3.8 轨迹](agent-foundation/traces/3.8.7-scrollview-web.jsonl)：相同的 Button 轻点都成功，拖动超过源码阈值都模拟取消；2.4 在 MOVE 捕获中同步移动 Content，3.8 在后续 `update(dt)` 移动。滚轮超时两版均发 `scroll-ended`，但 2.4 留下 `_scrolling=true`，3.8 清为 false，影响下一轮 `scroll-began`。两份 UI 追踪 skill 和[验证记录](agent-foundation/skills/ui-system-validation.md)已同步。阶段 7 还需完成两版真实窗口 resize、解释 3.8 旧 Graphics/Label/Button 探针两次点击失败、ScrollBar/边界/惯性/嵌套滚动以及 Native 手势；未观察的行为继续标为待验证。
- 阶段 7 剩余 UI 边界按用户选择暂缓，不阻塞阶段 8。真实 Chrome 窗口缩小在两版默认编辑器 Web 预览中未改变 960×640 游戏 Canvas/View；记录于[验证说明](agent-foundation/skills/ui-system-validation.md)，不能外推至 Web 构建或全屏模式。
- 阶段 8 已开始：分别建立[2.4 动画与表现](2.x/08-animation-and-effects.md)、[3.8 动画与表现](3.x/08-animation-and-effects.md)源码入口和[相同行为首轮对照](comparisons/08-animation-and-effects.md)。动画/缓动的管理器、系统优先级及音频/粒子生命周期入口已由源码定位，缓动进一步取得两版 Web 固定时钟轨迹。七份版本专属[候选 skill 与待验证清单](agent-foundation/skills/animation-effects-validation.md)已建立；普通剪辑仍未运行，音频并发与 3D 粒子已有局部 Web 轨迹。
- 阶段 8 第二轮源码追踪已补充剪辑曲线/姿态求值、延迟事件、2.4 Action 与节点激活关系、3.8 Marionette 姿态图、音频异步操作和粒子停发射语义。2.4 首次缓动预览因页面隐藏且游戏暂停未推进帧数，已记录为[无效环境轨迹](agent-foundation/traces/2.4.15-stage8-preview-state.jsonl)；后续页面可见、控制台恢复后取得[2.4 固定时钟轨迹](agent-foundation/traces/2.4.15-stage8-tween-web.jsonl)和[3.8 固定时钟轨迹](agent-foundation/traces/3.8.7-stage8-tween-web.jsonl)。旧无效轨迹不参与行为对照。
- 阶段 8 音频链已对照具体官网页面：2.4 `AudioSource` 与 `cc.audioEngine` 是两条公开入口，3.8 使用 `AudioSource` 与 `playOneShot`；两版都有旧 clip 异步结果保护，但操作队列、播放器归属和平台释放路径不同。细节与未验证条件见两版独立笔记和对应候选 skill。
- 阶段 8 音频并发策略已补源码对照：2.4 的 `cc.audioEngine` 按同一 `nativeUrl` 的 ID 列表淘汰最早者（本快照限额 24），不涵盖组件入口；3.8 的 `AudioManager` 在普通与 one-shot 的平台总限额中优先淘汰最早 one-shot。3.8 异步 one-shot 在组件销毁后是否迟到启动仍是待测假设；两版已取得 Web 并发局部轨迹；Native、真实声音中断与释放仍待验证。
- 阶段 8 音频运行验证的输入已准备：两套示例各新增 `resources/stage8-tone-a/b.wav`，两份[2.4](agent-foundation/probes/stage8-audio-2.4.js)和[3.8](agent-foundation/probes/stage8-audio-3.8.js) Web 探针分别测同/异 URL 的 ID 状态与普通/one-shot 通道压力。WAV 格式与探针语法已核对；对应 Creator 已生成 `audio-clip` `.meta`，3.8 标记 `imported=true`。两版随后取得加载与 Web 并发播放轨迹，剩余项目按[阶段 8、9 缺口清单](agent-foundation/stage8-9-gap-audit.md)补测。
- 阶段 8 音频场景/暂停链补查：2.4 `AudioClip.destroy` 会调用 `audioEngine.uncache`，全局播放 ID 能否跨场景由实际 Clip 自动释放决定；3.8 普通组件销毁重置播放器，而 one-shot 独立于组件，Clip 自己的播放器另行销毁。2.4 `cc.game.pause` 接 `audioEngine._break`，3.8 普通平台播放器监听 `Game.EVENT_PAUSE`，one-shot 不走相同监听；两版仍需按平台打点验证声音存续。
- 阶段 8 粒子链已按 2D/3D 拆开：两版 2D `stopSystem` 都停止发射且模拟器继续处理旧粒子；2.4 另有 `ParticleSystem3D`，3.8 的 3D `ParticleSystem` 增加 `stopEmitting`。3.8 2D 的 `_canRender` 同时依赖 `_stopped`，旧粒子是否继续可见是待验证的源码疑点，不能由“继续模拟”推断画面。
- 阶段 8 补查 2D 粒子的渲染关闭时机：2.4 的 `stopSystem` 不直接清 RenderFlow 渲染标志，自然结束才 `disableRender`；3.8 的 `stopSystem` 不主动标脏，`_stopped` 对 `_renderFlag` 的影响要等 UIRenderer 脏更新。旧粒子能否在停发射后继续可见仍须同时记录粒子数、渲染标志与画面，详见两版独立笔记和[对照](comparisons/08-animation-and-effects.md)。
- 阶段 8 2D 粒子自动移除已追至模拟器空粒子判断：两版 `autoRemoveOnFinish` 最终调 `node.destroy()`，影响整节点且实际销毁延后；3.8 若 `renderData` 为空，会在完结判断前早退，是需打点的条件分支。无粒子停止与有粒子排空要分别验证，不能仅用 `stopSystem` 的调用时刻代表销毁时刻。
- 阶段 8 3D 粒子生命周期已分别追至 `_emit/update/stop`：非循环两版都先停发射、后排空、再自动停止；手动 `stop` 清粒子。2.4.15 手动停止不清 `isEmitting` 状态，3.8 清除并另提供 `stopEmitting`。3.8 官网 RenderCulling 三模式影响离屏模拟与排空时机；两版 3D 均无 2D `autoRemoveOnFinish`。详见独立笔记、对照与版本专属 skill；两版手动步进 Web 轨迹已取得，自然帧画面仍待验证。
- 阶段 8 已准备两版页面内存[2.4 3D 粒子状态探针](agent-foundation/probes/stage8-particle3d-2.4.js)与[3.8 3D 粒子状态探针](agent-foundation/probes/stage8-particle3d-3.8.js)，使用临时节点和真实组件、直接手动步进。此前受命令环境网络隔离和 Chrome 标签页访问超时影响；随后通过 Codex 内置浏览器访问本机 Creator Web 预览，两份脚本均取得手动步进状态轨迹；生成脚本已按 SHA-256 恢复。它们不覆盖真实画面和剔除模式，后续分别验证。
- 阶段 8 固定时钟缓动已在两版 Web 预览验证：2.4 走 `Node.pauseAllActions/resumeAllActions`，3.8 走 Tween 实例 `pause/resume`；同参数关键值一致，管理器顺序相反。两种 API 的作用范围不同，且单 Tween 实验不证明多 Tween 暂停范围。仓库探针最终文本已加入精简输出并通过语法检查，尚未逐字重跑。
- 阶段 8 骨骼动画已核对两版手册和源码：2.4 `SkeletonAnimation`/`SkeletonAnimationClip` 在 Model 的 `precomputeJointMatrix` 条件下改走关节矩阵曲线；3.8 `SkeletalAnimation.useBakedAnimation` 在预烘焙/实时求值间切换。3.8 示例的 `main.scene → soldier.prefab → Take 001.animation` 已按 UUID 核实，且预制体设置 baked、`playOnLoad=true`；[Web 快照](agent-foundation/traces/3.8.7-stage8-skeletal-web.jsonl)确认播放中、baked 帧索引变化及四个 `BakedSkinningModel` 关联。事件与 Socket 尚未测。
- 阶段 8 的[3.8 士兵只读快照探针](agent-foundation/probes/stage8-skeletal-3.8.js)已按 Web 预览 legacy `cc` 实际导出名 `SkeletalAnimationComponent` 加兼容别名；等价只读代码取得两次自然帧快照，仓库脚本最终文本通过语法检查、尚未逐字重跑。
- 阶段 8 进一步沿 3.8 预烘焙路径追至 `JointAnimationInfo` 帧索引、`JointTexturePool` 贴图与逐帧包围盒、`BakedSkinningModel` uniform/实例属性更新及 Socket 的单独 CPU 更新；官网的 GPU 蒙皮说明与源码连接见[3.8 独立笔记](3.x/08-animation-and-effects.md)。这条链已经进入[3.8 动画诊断 skill](agent-foundation/skills/cocos3-animation-tween-trace/SKILL.md)，真实画面与资源释放时序仍待运行验证。
- 阶段 8 同步追完 2.4 预计算路径：`JointMatrixCurve` 写场景关节节点 `_jointMatrix`，`SkinnedMeshRenderer` 在提交网格前组装当前关节矩阵，按设备容量送 uniform 或本渲染器贴图。与 3.8 的共享预烘焙剪辑贴图形成明确区别，见[2.4 独立笔记](2.x/08-animation-and-effects.md)、[对照](comparisons/08-animation-and-effects.md)和[2.4 动画诊断 skill](agent-foundation/skills/cocos2-animation-tween-trace/SKILL.md)。2.4 示例缺骨骼资源，仍无运行轨迹。
- 阶段 8 普通属性剪辑已对照两版官网剪辑/事件页和源码：2.4 的 `curveData.props`、事件曲线及直接采样，与 3.8 的 VectorTrack/通道、混合缓冲及独立事件求值路径分别写入独立笔记。两版源码的时间轴事件首次采样可同步触发当前帧，后续跨帧事件入延迟队列。两份页面内存[2.4 探针](agent-foundation/probes/stage8-clip-tween-2.4.js)和[3.8 探针](agent-foundation/probes/stage8-clip-tween-3.8.js)已含临时接收组件并通过语法检查，等待 Web 预览执行；同属性竞争、组件状态事件和时间轴函数事件均不能写成已验证。
- 阶段 9 已开始，阶段 8 的粒子、音频和普通剪辑预览探针当时保留为待验证，不作为物理研究的前置条件。按[2.4 物理与碰撞](https://docs.cocos.com/creator/2.4/manual/zh/physics/index.html)、[2.4 3D 物理](https://docs.cocos.com/creator/2.4/manual/zh/physics-3d/physics-manager.html)、[3.8 2D](https://docs.cocos.com/creator/3.8/manual/zh/physics-2d/physics-2d.html)与[3.8 3D](https://docs.cocos.com/creator/3.8/manual/zh/physics/index.html)官网专题分别建[2.x 笔记](2.x/09-physics-and-spatial.md)、[3.x 笔记](3.x/09-physics-and-spatial.md)和[同一行为对照](comparisons/09-physics-and-spatial.md)。首轮源码已区分 2.4 简单碰撞/Box2D/3D 三链与 3.8 2D/3D 后端选择、`postUpdate` 步进和回调；两份[候选 skill 与验证矩阵](agent-foundation/skills/physics-spatial-validation.md)已建立；现已有两版局部 Web 轨迹。
- 阶段 9 的 2D 碰撞与查询已做第二轮源码校准：2.4 普通碰撞的组过滤、`Stay`、移除触发 `Exit` 与 Box2D 单对象 `testPoint`，对照 3.8 Builtin 双向组过滤、BEGIN/END、空射线结果及 Builtin/TypeScript Box2D 数组 `testPoint`。3.8 [手册点测试段落](https://docs.cocos.com/creator/3.8/manual/zh/physics-2d/physics-2d-system.html)与[API 参考](https://docs.cocos.com/creator/3.8/api/zh/class/PhysicsSystem2D)和 3.8.7 源码在返回形状上不一致，已保留文档差异；TypeScript Box2D Web 轨迹确认数组返回与复用，后续手动步进又确认其刚体接触监听门槛。其他后端仍只有源码结论。
- 阶段 9 的 3D 事件名称也已按官网和源码核对：2.4 手册使用 `trigger-enter`/`collision-enter`，2.4.15 Cannon 另外派发 `onTrigger…`/`onCollision…` 兼容名，而 Builtin 仅有连字符 trigger；3.8 使用 `onTrigger…`/`onCollision…`，Collider 订阅会更新事件需求标记。两版 Cannon 都复用事件数据；两版独立笔记、对照和候选 skill 已同步，运行回调顺序仍待打点。
- 阶段 9 的 3D 后端查询再校准：两版 3D Builtin 都能做物理射线查询，不能套用 3.8 2D Builtin 的空射线结论；3.8.7 3D Builtin 的射线结果法线为零，且两版 3D Builtin 源码均忽略 `queryTrigger`。3.8 官网提供[几何投射 API](https://docs.cocos.com/creator/3.8/manual/zh/physics/physics-sweep.html)，本快照只有 Bullet/PhysX 后端实现 Sweep，Builtin/Cannon 方法直接警告并返回 `false`。当前 Cannon/Bullet 的最小射线后来已取得 Web 轨迹；Builtin、Sweep 与其他后端仍待验证，细节见阶段 9 独立笔记和[验证矩阵](agent-foundation/skills/physics-spatial-validation.md)。
- 阶段 9 的第一轮 2D 运行验证已准备[2.4 页面内存探针](agent-foundation/probes/stage9-2d-query-contact-2.4.js)与[3.8 页面内存探针](agent-foundation/probes/stage9-2d-query-contact-3.8.js)。2026-10-04 通过 2.4 预览生成脚本的临时注入取得[局部 Web 轨迹](agent-foundation/traces/2.4.15-stage9-2d-query-web.jsonl)：普通碰撞 Enter/Stay/Exit、Box2D Dynamic 查询命中及 Static 查询被过滤。生成脚本已按 SHA-256 还原；3.8 探针随后在 TypeScript Box2D Web 预览运行。
- 阶段 9 又核对了 3.8 的 `box2d/`、`box2d-wasm/`、`box2d-jsb/` 三套包装器：系统级接触回调的刚体监听门槛一致；`testPoint/testAABB` 都返回去重的复用数组。结论已从仅 TypeScript Box2D 扩展为本仓库三套包装器的源码证据；TypeScript Box2D 已有 Web 查询轨迹，WASM/JSB、原生底层和接触事件仍未验证，见[3.8 独立笔记](3.x/09-physics-and-spatial.md)及[验证记录](agent-foundation/skills/physics-spatial-validation.md)。
- 3.8 仓库现成 `tests/physics2d/scene-query.ts` 按数组签名检查点测试，但 Builtin 的查询和事件测试被跳过。本机 `3.8.7engine/node_modules/.bin` 缺 Jest，聚焦测试未能执行；这不是测试失败或通过的证据。当时阶段 9 已有 2.4 局部 Web 轨迹，3.8 2D 查询与两版 3D 后端身份获局部验证，3D 射线/事件尚待验证；用户随后要求开始阶段 10，未完成项保留在[验证矩阵](agent-foundation/skills/physics-spatial-validation.md)，不标为阶段 9 完成。
- 阶段 9 后端接线已补查：2.4 3D 由构建宏控制 Cannon/Builtin 构造器绑定及 Director 管理器创建；3.8 的 2D/3D 后端先在预子系统事件注册，再于 Director 初始化或手动异步加载后创建系统与 World。3.8 2D `.instance` 会懒创建 World，3D `.instance` 可能尚不存在；探针先查选择器标志，再核实系统和 World，不调用 2D `selector.switchTo` 改写现场。详见两版[独立笔记](2.x/09-physics-and-spatial.md)、[3.8 笔记](3.x/09-physics-and-spatial.md)与[验证状态](agent-foundation/skills/physics-spatial-validation.md)。阶段 9 仍待其余运行轨迹。
- 阶段 10 已在本轮可验证的 Web 预览与 Mac 已发布包范围收口，阶段 9 未完成项仍保留。已按 2.4/3.8 官网 Web、原生、小游戏与 JSB 页面建立[2.x 发布与原生笔记](2.x/10-publishing-and-native.md)、[3.x 独立笔记](3.x/10-publishing-and-native.md)和[同一启动行为对照](comparisons/10-publishing-and-native.md)。源码追到 2.4 `AppDelegate → jsb-builtin → main.js → boot`，3.8 `CocosApplication/BaseGame → web-adapter → main.js → application.js → game.init/run`，并区分 2.4 `CC_JSB/CCSys` 与 3.8 `cc.config.json` 的 PAL 构建分流。两份[候选诊断 skill 与验证记录](agent-foundation/skills/publishing-native-validation.md)已建立；小游戏宿主未验证。
- 阶段 10 的帧驱动继续追到 2.4 `CCGame._setAnimFrame/_runMainLoop` 与 3.8 `Pacer` 的 Web/Native 实现、`Engine::tick → events::Tick → gameTick`。构建来源也已核查：3.8 `build/mac/cocos.compile.config.json` 明确记录使用 Creator 3.8.7 安装包内置的 TS/Native 引擎，故此包不能验证邻接 `3.8.7engine` 的源码改动；2.4 `local/builder.json`/`settings/builder.json` 未给出引擎路径。详见两版笔记及[阶段 10 验证记录](agent-foundation/skills/publishing-native-validation.md)。
- 阶段 10 已用两份[2.4 原生轨迹](agent-foundation/traces/2.4.15-stage10-mac-native-startup.jsonl)和[3.8 原生轨迹](agent-foundation/traces/3.8.7-stage10-mac-native-startup.jsonl)记录初始化、场景启动前后 `AFTER_DRAW` 与平台标志；两版原生包均有 `window/document` 而 `isBrowser=false`。临时生成脚本已逐字节还原。与阶段 1 各自同场景 Web 预览轨迹的事件关系已写入[对照](comparisons/10-publishing-and-native.md)；正式 Web 发布包、小游戏、移动端与自定义引擎包仍是各自独立的未验证范围。
- 阶段 11 已启动：按官网网络、存储、多语言、热更新与平台扩展专题建立[2.x 独立笔记](2.x/11-auxiliary-capabilities.md)、[3.x 独立笔记](3.x/11-auxiliary-capabilities.md)及[同一行为对照](comparisons/11-auxiliary-capabilities.md)。首轮源码定位和候选 skill 状态见[验证记录](agent-foundation/skills/auxiliary-capabilities-validation.md)；两套现有 Mac 包已分别验证唯一临时键跨进程重启的读取与删除，其余专题及 Web/小游戏仍待运行验证。
- 阶段 11 的业务 HTTP 已取得[200/503](agent-foundation/traces/README.md)与[连接被拒绝](agent-foundation/skills/auxiliary-capabilities-validation.md)的两版 Mac 轨迹：XHR 对 503 均 `onload`，3.8 `fetch` 对 503 仍 resolve；连接被拒绝且 XHR 超时设为 4 秒时，2.4 XHR 两轮都 `ontimeout`，3.8 XHR 两轮都 `onerror`、`fetch` rejected。两份网络诊断候选 skill 已编写；资源下载、TLS、其他网络失败及 Web/小游戏仍需分别验证。
- 阶段 11 先取得两版[Mac 原生热更新入口快照](agent-foundation/skills/auxiliary-capabilities-validation.md)：现有包同时暴露普通资源管理器和原生热更新构造器；3.8 源码还显示本地 manifest 加载可修改搜索路径并清理旧缓存，所以只读探针没有创建管理器。两个示例缺 `.manifest`，后续更新实验全部使用隔离临时 manifest 与缓存。
- 阶段 11 的[Mac WebSocket 验证](agent-foundation/skills/auxiliary-capabilities-validation.md)在两包均完成文本与五字节二进制回显；连接后 TCP 重置只见 `open → close`，拒绝握手 HTTP 403 则见 `error → close`、没有 `open`。3.8 拒绝握手的 `close` 仍报 `code=0/wasClean=true`，不可据此判定连接成功。2.4 包只有全局 `WebSocket` 构造器，3.8 包还暴露 `jsb.WebSocket`；这不是跨平台导出规则。`wss://`、较大/分片消息及 Web/小游戏仍待独立验证。
- 阶段 11 的[原生热更新同版本探针](agent-foundation/probes/stage11-mac-hotupdate-check.py)已在两版 Mac 包分别运行：构造管理器即前置临时 manifest 目录；`checkUpdate()` 各只请求一次 `version.manifest`，事件代码均为 `5 → 4`，未下载资源。3.8 包在代码 4 回调中 `getState()=13`，但其 JS 常量 `UP_TO_DATE=12/FAIL_TO_UPDATE=13`；邻接 C++ 状态枚举多出 `PREPARE_UPDATING`，因此诊断不能只用 JS 状态常量。两份[版本专属候选 skill](agent-foundation/skills/auxiliary-capabilities-validation.md)已记录该边界。
- 阶段 11 用同一探针的远端 `1.0.1` 分支取得两版[新版本检查轨迹](agent-foundation/skills/auxiliary-capabilities-validation.md)：`checkUpdate()` 先请求版本再请求完整 manifest，事件均为 `5 → 5 → 3`，没有资源文件请求；各临时缓存留有 `project.manifest.temp`。2.4 代码 3 时状态 9 对应包内 `READY_TO_UPDATE`，3.8 状态 10 对应邻接 C++ `READY_TO_UPDATE`，却被包内 JS 表标为 `UPDATING`。这进一步确认 3.8 状态常量错位。
- 阶段 11 又取得两版[单文件更新及重启轨迹](agent-foundation/skills/auxiliary-capabilities-validation.md)：在事件 3 中调用 `update()` 后，服务端各见一个哨兵文件请求，两版均给 `UPDATE_FINISHED=8`，缓存中有版本 `1.0.1` 的 manifest 与正确字节。另起进程后重新构造管理器，选择缓存 manifest、前置缓存目录，并以代码 4 结束检查。3.8 的代码 8/4 回调仍 `getState()=13`，不能按 JS `FAIL_TO_UPDATE` 误判。探针在宿主启动后才构造管理器，尚未证明新脚本在游戏启动前被加载；真实资源覆盖、失败重试和回滚另测。
- 阶段 12 已按[2.4 扩展与诊断](2.x/12-editor-extension-and-diagnostics.md)、[3.8 扩展与诊断](3.x/12-editor-extension-and-diagnostics.md)的官网页面建立独立源码地图及[同一行为对照](comparisons/12-editor-extension-and-diagnostics.md)。[只读来源探针](agent-foundation/probes/stage12-engine-provenance.py)确认现有 3.8 Mac 构建的 TS/Native 均指向 Creator 安装目录内置引擎；2.4 两份 builder 配置不含引擎路径，来源仍未确定。两份来源诊断候选 skill、两份扩展菜单诊断 skill 与[验证边界](agent-foundation/skills/editor-extension-diagnostics-validation.md)已记录。阶段 12 按已定义的诊断与菜单消息范围验收完成；自定义引擎重新构建、模板执行及性能测量留给对应目标任务单独验证。
- 阶段 12 的两版项目现各有一个只记 `load/unload/ping` 的扩展探针。[当前轨迹](agent-foundation/traces/stage12-editor-extension.jsonl)中 3.8 管理器刷新与启用成功，主入口打印 `load`，点击 `Develop → Stage 12 Probe` 后日志打印 `ping`；2.4 完整重开工程后 Package Manager 列出探针，点击 `Packages → Stage 12 Probe` 后控制台打印 `ping`。两版各自的菜单消息链已经验收；2.4 初次 `load` 与 Reload 后 `unload/load` 的时点未取证。3.8 原生 Profiler 的 `CC_PROFILE_OBJECT_INC` 宏曾把 `CC_PROFILER` 误写为 `C_PROFILER`；[开启宏的聚焦 Clang 编译](agent-foundation/traces/stage12-profiler-macro.jsonl)先复现错误，修正后在开启/关闭两态均通过。完整原生构建与实际性能测量仍未运行。
- 2026-10-05 的[阶段 8、9 缺口清点](agent-foundation/stage8-9-gap-audit.md)已补运行证据：两版 Web [2.4 音频](agent-foundation/traces/2.4.15-stage8-audio-web.jsonl)、[3.8 音频](agent-foundation/traces/3.8.7-stage8-audio-web.jsonl)并发轨迹；两版 [2.4 3D 粒子](agent-foundation/traces/2.4.15-stage8-particle3d-web.jsonl)、[3.8 3D 粒子](agent-foundation/traces/3.8.7-stage8-particle3d-web.jsonl)手动步进轨迹；[两版后端身份](agent-foundation/traces/stage9-backend-web.jsonl)及 [3.8 TypeScript Box2D 查询](agent-foundation/traces/3.8.7-stage9-2d-query-web.jsonl)。2.4 `getParticleCount()` 在本次粒子实验中读分配池长度，非活动数。普通动画剪辑、2D 粒子、音频跨场景/原生仍是缺口；预览是否使用相邻源码构建仍未确认。
- 同日补[两版 3D 射线](agent-foundation/traces/stage9-3d-ray-web.jsonl)：2.4 当前 Cannon 临时启用后同形状命中距离 9，3.8 当前 Bullet 命中距离约 9 且法线为 `(0,0,-1)`，两版偏移射线不命中。[3.8 TypeScript Box2D 手动接触](agent-foundation/traces/3.8.7-stage9-2d-contact-web.jsonl)确认无监听刚体对没有事件、单侧开启监听后 Collider/系统发 Begin。当时自然 Director 帧、2.4 Box2D 接触、3D 事件及其他后端仍待验证；两版独立笔记、[比较](comparisons/09-physics-and-spatial.md)和候选 skill 已同步。
- 两版 Box2D 的 fixture 登记时点又经源码核对：创建 fixture 时登记监听，接触派发时再检查当前开关。[2.4 对照探针](agent-foundation/probes/stage9-2d-contact-listener-2.4.js)已准备三组传感器，分别测试始终关闭、创建前开启、创建后开启；本次运行前 Mac 曾锁屏且预览服务停止，故当时只记录源码结论。
- 随后在 2.4 Web 预览完成上述三组 Box2D 手动步进：[轨迹](agent-foundation/traces/2.4.15-stage9-2d-contact-web.jsonl)确认监听关闭的传感器 fixture 未登记、无事件；创建前开启 A 监听时，A 收到 Begin，禁用 B Collider 后 A 收到 End；创建后才开启 A 的监听属性为真但 fixture 未登记、仍无事件。探针仅在预览内构造对象，使用暂停游戏后的 `PhysicsManager.update(0.05)`，没有改场景或生成脚本。现有两版接触轨迹仍不能说明自然 Director 帧顺序；阶段 9 对照与候选 skill 已同步。
- 2026-10-06 回补阶段 8 音频生命周期：两版[2.4 组件](agent-foundation/traces/2.4.15-stage8-audio-lifecycle-headless-web.jsonl)与[3.8 组件](agent-foundation/traces/3.8.7-stage8-audio-lifecycle-headless-web.jsonl) WebAudio 轨迹分别记录自然结束、停用/启用和销毁；各自用 `stage4-empty` 真实磁盘场景测试 `autoReleaseAssets=false/true`，动态 `resources.load` Clip 在切换后均仍缓存，显式释放才销毁。2.4 全局音频 ID 随 Clip 显式释放而停止；3.8 [one-shot 底层轨迹](agent-foundation/traces/3.8.7-stage8-audio-oneshot-backend-headless-web.jsonl)在源节点与 Clip 释放后自然结束。两版独立笔记、[同一行为比较](comparisons/08-animation-and-effects.md)和版本专属音频 skill 已同步；无头 Chrome 为隔离生命周期放宽首次手势限制，未验证默认自动播放、真实听感、静态场景音频依赖与原生。
- 2026-10-06 静态场景音频补测：[3.8 序列化 Clip 轨迹](agent-foundation/traces/3.8.7-stage8-audio-static-scene-headless-web.jsonl)在真实磁盘场景切换中确认 Clip 属于旧 Scene 依赖，引用数 1→0；`autoReleaseAssets=true` 下一帧销毁，false 保留缓存。2.4 同类 `.fire` 源文件已加入 Clip UUID，但 Creator 的旧导入缓存仍为 `_clip=null`；按[官方 AssetDB 刷新文档](https://docs.cocos.com/creator/2.4/manual/zh/extension/asset-management)重新导入后才可验证，不从 3.8 结果外推。
- 2026-10-06 2.4 引擎释放分支隔离验证：[内存构造 Scene 依赖](agent-foundation/traces/2.4.15-stage8-audio-injected-scene-dependency-headless-web.jsonl)后，Clip 引用数在真实磁盘场景切换时 1→0；`autoReleaseAssets=false` 保留 Clip 和独立音频 ID，true 使 Clip 销毁并通过 `uncache` 停止该 ID。此轨迹只证明给定依赖记录时的 Web 引擎路径，不能替代 Creator 对源 `.fire` 的正式导入。临时改动单个生成缓存未改变预览，已经按 SHA-256 恢复；[诊断轨迹](agent-foundation/traces/2.4.15-stage8-audio-static-scene-stale-import-headless-web.jsonl)保留了边界。
- 2026-10-06 又补 3.8 WebAudio 的[one-shot 满额淘汰](agent-foundation/traces/3.8.7-stage8-audio-oneshot-eviction-headless-web.jsonl)与[慢加载后源节点销毁](agent-foundation/traces/3.8.7-stage8-audio-oneshot-slow-load-headless-web.jsonl)：前者直接记录 one-shot source 先 `stop()` 再启动新普通 source，后者在延迟的 XHR 放行前确认节点销毁、放行后仍记录底层 `start()`。已更新 3.8 独立笔记、[同一行为对照](comparisons/08-animation-and-effects.md)和版本专属候选 skill；剩余重点是静态场景依赖、原生/DOM Audio、后台及真实听感。
