# Cocos 引擎源码学习总纲

## 目标与范围

沿着六条独立课程线学习 Cocos 引擎架构：Creator 2.4.15、Creator 3.8.7、Cocos2d-x 1.x、2.x、3.x、4.x。Creator 2.4.15 课程以 Web 浏览器运行时为目标，用 TypeScript 写精简实现；其他版本各自保留对应源码的语言、目录职责和能力边界。

每课围绕一个问题，包含源码位置、独立代码和一个可观察结果。跨版本相似概念不强行对应同名 API；某个版本没有同类功能时，说明版本边界，不补造实现。

## 已完成课程

- Creator 2.4.15、Creator 3.8.7：第 0 课元数据分析、第 1–29 课，以及第 31–34 课。
- Cocos2d-x 1.x、2.x、3.x、4.x：第 1–29 课，以及第 31–34 课。
- 第 23–29 课已把对象池的一组细碎知识合并为七个递进主题；六个版本仍各有独立代码。

## 后续阶段

下表是课程规划，不代表这些课的代码已经实现。预计新增 24 个主题课；落地时按源码职责调整边界，避免将单个方法拆成多课。

| 阶段 | 规划课次 | 范围 | 阶段结果 |
| --- | --- | --- | --- |
| 七：Action / Tween | 30–34（第 31–34 课已完成） | 时间推进、间隔与即时动作、组合、缓动和控制 | 用动作或 Tween 驱动节点属性，并能解释它如何进入每帧更新 |
| 八：UI 结构与交互 | 35–39 | Canvas、Widget、Layout、Label、Button | 建立可适配屏幕、可排布、可显示文本并可交互的基础 UI |
| 九：音频 | 40–42 | 资源、播放生命周期、并发与音量控制 | 加载并播放音效或背景音，观察播放、停止和资源生命周期 |
| 十：2D 物理 | 43–46 | 物理世界、刚体与碰撞体、接触、查询与调试 | 让节点参与 2D 模拟并处理碰撞或查询结果 |
| 十一：2D 粒子 | 47–49 | 粒子系统创建、发射与模拟、渲染和结束 | 从配置生成粒子，观察其更新、绘制与回收 |
| 十二：构建、打包与交付 | 50–53 | 目标配置、代码/资源构建、产物结构、启动与交付 | 从工程配置追到可运行的 Web 目录或原生应用包 |

### 七：Action / Tween（第 30–34 课，第 31–34 课已完成）

1. **动作更新链**：目标对象、动作管理器和逐帧推进之间的关系。
2. **时间动作（第 31 课已完成）**：持续时间、归一化进度与绝对目标插值；Cocos2d-x 1.x 直接插值，2.x–4.x 由 MoveTo 计算位移并复用 MoveBy。
3. **即时与延迟动作（第 32 课已完成）**：回调、延迟和完成时机；Cocos2d-x 1.x 在 `startWithTarget` 同步执行 CallFunc，Creator 2.4、3.8 和 Cocos2d-x 2.x–4.x 在动作更新时执行。
4. **动作组合（第 33 课已完成）**：Sequence 串行动作、Spawn 并行动作、较短分支补时，以及 Tween 链式组合入口。
5. **动作进度修饰（第 34 课已完成）**：缓动、重复和反向时间；ActionManager 暂停/恢复、动作停止与 cleanup 放在动作管理器和 Node 生命周期专题理解。

Cocos2d-x 1.x–4.x 的第 6 课已实现 ActionManager、基础间隔动作和 MoveBy；后续只补未覆盖的组合与控制机制。Creator 2.4.15 以 Action/Tween 源码为依据，Creator 3.8.7 以 Tween 系统为依据。

源码入口：Creator 2.4.15 `engine/2.4.15engine/cocos2d/actions/CCActionManager.js`、`CCActionInterval.js`、`tween.js`；Creator 3.8.7 `engine/3.8.7engine/cocos/tween/`；Cocos2d-x 各版本的 `actions/` 或 `cocos/2d/`。

### 八：UI 结构与交互（第 35–39 课）

1. **Canvas 与屏幕坐标**：设计分辨率、视图和 UI 根节点如何接起来。
2. **Widget 对齐**：锚点、父节点尺寸和窗口变化如何影响位置。
3. **Layout 排布**：子节点如何排列，尺寸何时重新计算。
4. **Label 显示文本**：文本属性如何进入布局与绘制。
5. **Button 交互**：输入命中、按钮状态和回调如何连起来。

Creator 源码入口：2.4.15 `cocos2d/core/components/CCCanvas.js`、`CCWidget.js`、`CCLayout.js`、`CCLabel.js`、`CCButton.js`，以及 `cocos2d/core/base-ui/CCWidgetManager.js`；3.8.7 `cocos/2d/framework/canvas.ts`、`cocos/ui/widget.ts`、`widget-manager.ts`、`layout.ts`、`cocos/2d/components/label.ts`、`cocos/ui/button.ts`。

Cocos2d-x 使用本版本实际提供的 `Layer`、`Menu`、`Label` 或 `ui::Widget` 等结构。旧版本没有 Creator 式 Canvas/Widget 组件时，记录其真实入口和缺失边界，不强行补齐同名课程实现。

### 九：音频（第 40–42 课）

1. **音频资源与引擎入口**：资源对象如何交给平台音频后端。
2. **播放生命周期**：播放、暂停、恢复、停止与播放完成。
3. **并发与控制**：背景音和音效的音量、循环、并发及实例释放。

源码入口：Creator 2.4.15 `cocos2d/core/components/CCAudioSource.js`、`cocos2d/audio/CCAudioEngine.js`；Creator 3.8.7 `cocos/audio/audio-manager.ts`、`audio-clip.ts`；Cocos2d-x 1.x–2.x `CocosDenshion/`，3.x–4.x `cocos/audio/`。按版本和目标平台分别说明后端差异。

### 十：2D 物理（第 43–46 课）

1. **物理世界**：世界启用、时间步进和场景更新的顺序。
2. **刚体与碰撞体**：静态/动态刚体、形状和材质如何映射到节点。
3. **接触与过滤**：碰撞分组、接触回调和响应。
4. **查询与调试**：射线或区域查询，以及调试绘制。

首轮只覆盖 2D 物理。Creator 2.4.15 入口为 `cocos2d/core/physics/CCPhysicsManager.js`、`CCRigidBody.js`；Creator 3.8.7 为 `cocos/physics-2d/framework/physics-system.ts`、`components/rigid-body-2d.ts`；Cocos2d-x 3.x–4.x 查看对应 `physics/`。1.x–2.x 中 Box2D 集成方式需按具体版本源码确认，区分引擎模块和随仓库提供的第三方库。

### 十一：2D 粒子（第 47–49 课）

1. **粒子系统创建**：发射器配置、贴图和粒子数据从哪里进入运行时。
2. **粒子模拟**：发射、寿命、速度和每帧状态更新。
3. **粒子绘制与结束**：渲染提交、批处理和粒子清理。

源码入口：Creator 2.4.15 `cocos2d/particle/CCParticleSystem.js`；Creator 3.8.7 `cocos/particle-2d/particle-system-2d.ts`、`particle-simulator-2d.ts`；Cocos2d-x 1.x–2.x `cocos2dx/particle_nodes/`，3.x–4.x `cocos/2d/CCParticleSystem.*`。首轮关注 2D 粒子，3D 粒子另列专题。

### 十二：构建、打包与交付（第 50–53 课）

1. **目标与构建入口**：工程版本、目标平台、构建模式和实际构建入口如何确定。
2. **代码与引擎构建**：Creator 如何选择运行时代码；Cocos2d-x 如何编译并链接游戏与引擎。
3. **资源处理与产物结构**：资源如何进入 Web 输出或原生 `Resources`，生成配置和清单承担什么职责。
4. **启动与交付**：从生成物追踪运行时启动；区分 Web 静态部署、缓存更新和原生应用包。

Creator 2.4.15 首轮只研究与 Web 浏览器目标一致的构建输出。Creator 的完整 Editor Builder 不在本地引擎源码中；课程从公开构建入口、引擎宏/启动代码和可检查的输出分别说明证据，不能声称还原闭源 Builder 的全部步骤。Creator 3.8.7 暂列在总纲，当前不执行构建或实机验收。

Cocos2d-x 1.x–4.x 分别沿各自版本的工程模板、构建脚本、平台入口和资源目录追踪；不能把 4.x 的 CMake 路径套到旧版。第一轮每版只选有明确工具链和输出证据的一个目标平台，其他平台另列，不从一次桌面构建推断移动端或商店包状态。

源码和研究入口：Creator 2.4.15 `engine/2.4.15engine/gulp/util/utils.js`、`predefine.js`、`cocos2d/core/CCGame.js`、`CCSys.js`，以及 [发布与原生研究](2.x/10-publishing-and-native.md)；该引擎目录不包含完整 Creator Builder。Cocos2d-x 4.x 从 `engine/cocos2d-x-4/templates/cpp-template-default/`、CMake 配置和[项目构建边界](cocos2d-x-creator2x-source-study-plan.md)入手；该仓库当前 macOS x86_64 构建证据不能外推到其他平台。其他版本在对应课程 README 中列明本地版本源码和平台工程入口。

## 课程落地规则

- 各版本从自己的课程大纲和源码路径继续；规划课号用于组织主题，源码已有的基础行为不重复讲解。
- 新课开始前先核对对应版本的实际源文件、关键调用和支持平台，再固定课名与代码边界。
- Creator 课程继续以 Web 浏览器运行时为主；引擎源码路径或模拟结果不表述为编辑器/目标平台验收。
- 打包课程先固定引擎补丁版、目标平台、构建模式和工程身份；运行构建前核对工具链与 SDK，下载依赖、安装工具或改全局环境前先取得授权。
- 构建日志、生成物检查和目标运行时验收分开记录；未实际构建的平台保持未验证状态。
- 每个课程 README 记录本课目标、源码文件与关键函数、独立代码入口、可观察结果和简化点。
- 本总纲只规划 2D UI、音频、2D 物理和 2D 粒子。3D 物理、3D 粒子、动画状态机和平台专项以后按需扩展。

## 各版本课程入口

- [Creator 2.4.15](../learn_2.4cocoscreator/课程大纲.md)
- [Creator 3.8.7](../learn_3.8cocoscreator/课程大纲.md)
- [Cocos2d-x 1.x](../learn_cocos2d-1x/课程大纲.md)
- [Cocos2d-x 2.x](../learn_cocos2d-2x/课程大纲.md)
- [Cocos2d-x 3.x](../learn_cocos2d-3x/课程大纲.md)
- [Cocos2d-x 4.0](../learn_cocos2d-4x/课程大纲.md)
