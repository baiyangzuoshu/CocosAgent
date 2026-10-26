# Cocos2d-x 4.0 与 Cocos Creator 2.4.15 对照研究计划

## 目标与边界

以仓库中的 `engine/cocos2d-x-4/`（上游标记为 cocos2d-x 4.0）和 `engine/2.4.15engine/`、`2.4.15NewProject/` 为具体源码样本，比较游戏开发者完成相同行为时两套技术栈的入口、对象模型、资源工作流、平台边界与验证方法。目标是形成可追溯的架构说明与任务型 skill，不是 API 迁移表，也不是对 Cocos2d-x 与 Creator 产品优劣的评分。

两者范围不同，结论必须把边界说清：Cocos2d-x 仓库提供跨平台 C++ 游戏框架、平台适配和 CMake/模板/测试代码；Creator 2.4.15 还包含编辑器集成、AssetDB、场景/Prefab 编辑和项目构建流程。Creator 编辑器内部未包含在 `engine/2.4.15engine/` 中，因此只依据本仓库源码不能还原编辑器全部实现。

## 研究对象

| 对象 | 本地来源 | 版本依据 | 研究范围 |
| --- | --- | --- | --- |
| Cocos2d-x | `engine/cocos2d-x-4/` | `README.md`、`CHANGELOG` 标记 4.0；记录具体文件时再核对源码状态 | C++ 核心、Lua bindings、平台层、模板、构建与 tests；不把外部依赖或缺失子模块假定为已检出 |
| Creator 2.x | `engine/2.4.15engine/`、`2.4.15NewProject/` | 当前 Creator 2.4.15 源码快照及示例工程 | JS 运行时、Creator 工程/资源/场景格式、已在本地的构建和扩展代码；Creator 编辑器闭源/外置部分单列 |

上游 Cocos2d-x v4 文档与当前本地快照可能存在版本/文档差异。先读本地 README、CHANGELOG、CMake 配置和 git 历史（若可用），再以源码符号和官方 v4 文档逐项核对；任何不一致都注明证据版本，不用在线 `v4` 分支替代本地快照结论。

## 官方资料基线

- [Cocos2d-x v4 Programmer's Guide](https://docs.cocos2d-x.org/cocos2d-x/v4/en/)
- [Cocos2d-x v4 Basic Concepts](https://docs.cocos2d-x.org/cocos2d-x/v4/en/basic_concepts/)
- [Cocos2d-x v4 Director](https://docs.cocos2d-x.org/cocos2d-x/v4/en/basic_concepts/director.html)
- [Cocos2d-x v4 Scene Graph](https://docs.cocos2d-x.org/cocos2d-x/v4/en/basic_concepts/scene.html)
- [Cocos2d-x v4 Release Notes](https://github.com/cocos2d/cocos2d-x/blob/v4/docs/RELEASE_NOTES.md)
- [Cocos Creator 2.4 中文手册](https://docs.cocos.com/creator/2.4/manual/zh/)
- [Creator 2.4 节点与组件](https://docs.cocos.com/creator/2.4/manual/zh/content-workflow/node-component.html)
- [Creator 2.4 资源工作流](https://docs.cocos.com/creator/2.4/manual/zh/asset-workflow/)

官方手册用于确定开发者可见概念和公开用法；本地源码用于解释具体快照的实现；示例、tests、编辑器和运行时实验用于验证行为。不能用一个来源替代其他来源。

## 研究阶段

| 阶段 | 同一开发目标 | 重点问题 |
| --- | --- | --- |
| 0. 来源与项目模型 | 打开、构建并定位一个最小游戏项目 | 项目模板、依赖、资产目录、生成文件分别由谁管理？Cocos2d-x 本地缺失的 submodule/dependency 是什么？ |
| 1. 启动与帧循环 | 启动应用并进入首个场景 | 平台入口、AppDelegate/Creator 预览宿主、Director、主循环、调度与渲染如何衔接？ |
| 2. 场景图与对象生命周期 | 创建节点、挂载行为、切场景并销毁对象 | Cocos2d-x `Node`/`Scene`、`Ref`/autorelease 与 Creator `Node`/`Component`/销毁队列分别维护什么不变量？ |
| 3. 脚本与事件 | 响应输入并更新游戏状态 | C++/Lua 代码入口、Creator JS 组件、监听器注册/移除、跨语言边界如何工作？ |
| 4. 资源与序列化 | 加载 Sprite/Prefab 或场景资源 | `FileUtils`/缓存/`SpriteFrameCache` 等与 Creator AssetDB、`.meta` UUID、序列化资源、`resources`/Bundle 的职责不能混淆；追踪身份和释放。 |
| 5. 2D 显示与 UI | 显示、布局并交互一个按钮 | `Sprite`/`Label`/`Menu`/`ui` 与 Creator `Node`+组件、Canvas、Widget、Button 的实际对象关系；不能只按同名概念映射。 |
| 6. 动画、音频与物理 | 移动对象、播放效果并处理碰撞 | Action/Animation、Scheduler、音频后端、Box2D/Chipmunk 与 Creator 对应模块的所有权及时序。 |
| 7. 渲染与图形后端 | 改变对象/材质并观察绘制 | Cocos2d-x renderer/backend 与 Creator 2.4 Web JS 和 Native/JSB 路径的边界；只在相同平台和配置下比较。 |
| 8. 构建与平台接线 | 生成并启动目标平台游戏 | CMake、`cocos` 控制台、模板、平台项目与 Creator Builder/构建模板之间的责任分配。 |
| 9. 工具、测试与扩展 | 定位问题并验证修复 | `cpp-tests`、Creator 预览/控制台/编辑器扩展各自能证明什么；缺少的 Creator Editor 源码或平台宿主能力明确标出。 |

## 研究方法与证据口径

1. 先确认项目类型与版本：读取项目标记、模板、构建配置和入口；不靠目录名或 API 名猜测。
2. 先分别描述每一侧，再比较同一个开发者目标。每侧追踪入口、核心对象、关键状态和最终可观察结果。
3. 把结论分成四类：官方公开行为、当前本地源码事实、运行/构建观察、基于前述证据的推断。推断要标明由哪些事实推出。
4. 记录 C++ 引用计数/autorelease、Lua/C++ 绑定、Creator JS/JSB、资源 UUID、序列化格式、平台宏与构建生成物等可能改变行为的边界。
5. 比较运行行为时固定平台、构建配置、内容与操作步骤。Web 结果不推广到 Native；桌面 C++ 结果不推广到 Android/iOS。
6. 遇到一侧不存在的工作流，写“产品/仓库边界不同”或“本地证据不足”，不强造一一对应 API。
7. 验证以现有 tests 和最小示例为优先。运行 CMake、`download-deps.py`、设备构建或安装工具链前先检查依赖、平台和副作用；本计划本身不要求下载依赖或改动示例工程。

## 技能产出规则

- Cocos2d-x 专属专题 Skill 按“一项开发主题一个 `SKILL.md`”组织在 `plugins/cocos2d-x-4/skills/<skill-name>/`，作为后续 Agent 可接入的独立技能源；不放入 `plugins/cocos-agent-2x/skills/`，避免把 C++ 框架工作流混入 Creator 原生 Agent 产品包。当前技能源目录不代表已经完成 Agent 安装、发现或运行时接线。
- 每个专题 Skill 只负责一个具体开发/诊断任务，必须包含该专题自己的流程图，前置标明 Cocos2d-x 版本、平台范围和证据状态，并链接对应源码地图/验证记录。专题在形成可复核源码地图及验证切片后独立发布；只有静态研究的主题必须明确“未做运行验证”，不得写成已验收。不能以一个通用 Cocos2d-x Skill 或比较 Skill 代替专题技能。
- 每个已研究的跨引擎专题独立维护一份比较 MD，放在 `docs/comparisons/cocos2d-x-4-vs-creator-2.4/`；它记录双方实现、源码/文档/运行证据、平台差异与未验证项。专题 Skill 是“如何完成 Cocos2d-x 任务”的流程说明，比较 MD 是按需读取的对照资料；Agent 只在跨引擎比较/移植任务中加载相关 MD，不默认加载整套比较文档。无需通用比较 Skill。
- 每份 skill 需覆盖一个真实开发任务，至少检查一个正常请求和一个容易误映射或证据不足的请求；记录试用结论和未覆盖平台。

### Cocos2d-x 专题目录

| 专题 | 技能源 | 状态 |
| --- | --- | --- |
| 工程配置与构建 | `cocos2d-x-4-project-build` | Skill 与[比较 MD](comparisons/cocos2d-x-4-vs-creator-2.4/01-project-build.md)已建立；macOS x86_64 模板构建/启动有运行证据，其他平台未验证 |
| 应用启动与帧循环 | `cocos2d-x-4-startup-frame` | Skill 与[比较 MD](comparisons/cocos2d-x-4-vs-creator-2.4/02-startup-and-frame.md)已建立；macOS 桌面路径源码追踪并运行，其他平台未验证 |
| Scene/Node/Component 生命周期 | `cocos2d-x-4-scene-node-lifecycle` | Skill 与[比较 MD](comparisons/cocos2d-x-4-vs-creator-2.4/03-scene-node-lifecycle.md)已建立；当前为静态源码研究，析构/回收时序未运行验证 |
| 鼠标/触摸输入事件 | `cocos2d-x-4-input-events` | Skill 与[比较 MD](comparisons/cocos2d-x-4-vs-creator-2.4/04-input-events.md)已建立；鼠标点击切片已验证，触摸与其他平台未验证 |
| 资源寻址、缓存与释放 | `cocos2d-x-4-assets-loading` | 源码地图、对照 MD 与 Skill 已建立；核对了现有 FileUtils/SpriteFrameCache 测试入口，运行时加载、引用计数及释放尚未验证 |
| 2D UI 与布局 | 后续独立建项 | 待源码地图与可复核验证切片 |
| Action、动画与 Scheduler | 后续独立建项 | 待源码地图与可复核验证切片 |
| 音频生命周期 | 后续独立建项 | 待源码地图与可复核验证切片 |
| 物理与空间查询 | 后续独立建项 | 待源码地图与可复核验证切片 |
| 渲染与性能诊断 | 后续独立建项 | 先完成统一条件的可重复测量，再独立建项 |
| 测试、日志与平台调试 | 后续独立建项 | 按真实调试场景建立可复用验证切片 |

## 当前状态

- 已确认比较对象为本地 Cocos2d-x 4.0 与 Creator 2.4.15 引擎源码快照；历史 Creator 示例工程和运行轨迹仅作为归档证据，不视为当前工作树可复测工程。
- 已建立[架构层面对照](comparisons/cocos2d-x-4-vs-creator-2.4.md)及五份按专题拆分的比较 MD；不维护通用比较 Skill。
- 已按专题建立 Cocos2d-x 技能源 `plugins/cocos2d-x-4/skills/`：项目构建、启动/帧循环、Scene/Node 生命周期、输入事件、资源加载/释放各有独立 Skill。项目构建、启动/首屏和桌面鼠标交互有 macOS 示例运行证据；Scene/Node 生命周期及资源缓存/释放仍是静态源码研究。Agent 的发现/加载集成尚未接线。
- 阶段 1 的 [Cocos2d-x 启动与帧循环](cocos2d-x/01-startup-and-frame.md) 已完成源码静态追踪；Creator 一侧复用已有[2.4.15 启动研究与 Chrome 预览轨迹](2.x/01-startup-and-frame.md)。
- 阶段 2 已补 [Cocos2d-x Scene/Node/Component 生命周期源码地图](cocos2d-x/02-objects-and-lifecycle.md)，并确认本地 v4 含有 `Component`/`ComponentContainer`。Creator 2.4.15 对应源码与 Chrome 运行轨迹复用既有[对象与场景研究](2.x/02-objects-and-scenes.md)。两边尚未做相同行为运行对照。
- 先前发现系统环境缺少 CMake、依赖 payload 与初始化 submodule；随后已在 `/private/tmp` 准备本轮专用 CMake/runtime，恢复构建依赖，并构建、启动 macOS x86_64 `cpp-tests` 与 `HelloCpp`。详细命令、补丁和限制见[Demo 记录](cocos2d-x-creator2x-demo.md)。这是本次对照验证环境，不代表其他机器具备相同构建条件。
- 首个[启动到帧循环对照](comparisons/cocos2d-x-4-vs-creator-2.4.md#首个切片启动到帧循环)已扩展为两边 Demo 实际启动及同一鼠标交互行为验证。运行后端不同，不能据此比较性能或帧耗时。
- 2026-10-26 完成资源寻址、缓存与释放的静态专题：单图以解析后的完整路径进入 `TextureCache`，SpriteFrame/纹理分层持有引用；Creator 侧 Asset Manager 则按 UUID/Bundle 请求并维护依赖引用。Skill 的静态路由检查覆盖了单图加载和 Creator UUID 易误映射请求；没有运行资源加载或释放探针。下一步先补两侧资源缓存/释放的可重复运行切片，再进入 2D UI/布局；性能对照须另行统一后端、平台、架构、素材与 Release 配置。
