# Cocos 引擎源码学习总纲

## 目标与范围

沿着六条独立课程线学习 Cocos 引擎架构：Creator 2.4.15、Creator 3.8.7、Cocos2d-x 1.x、2.x、3.x、4.x。Creator 2.4.15 课程以 Web 浏览器运行时为目标，用 TypeScript 写精简实现；其他版本各自保留对应源码的语言、目录职责和能力边界。

每课围绕一个问题，包含源码位置、独立代码和一个可观察结果。跨版本相似概念不强行对应同名 API；某个版本没有同类功能时，说明版本边界，不补造实现。

## 已完成课程

- Creator 2.4.15、Creator 3.8.7：第 0 课元数据分析和第 1–80 课。
- Cocos2d-x 1.x、2.x：第 1–53、56–65、71–75 课；本地快照不含引擎内置 3D 物理和 3D 粒子模块。
- Cocos2d-x 3.x、4.0：第 1–53、56–80 课。
- 第 23–29 课已把对象池的一组细碎知识合并为七个递进主题；六个版本仍各有独立代码。
- 第 56–65 课沿六个版本各自的渲染链路展开；第 66–80 课按物理、动画和 3D 粒子的源码能力分别落地。

## 已完成阶段与后续专题

第 1–80 课中各版本实际具备的主题均已落地。下表汇总阶段和版本范围；平台与运行时专项留作后续按目标选择。

| 阶段 | 课次范围 | 范围 | 阶段结果 |
| --- | --- | --- | --- |
| 七：Action / Tween | 30–34（第 30–34 课已完成） | 时间推进、间隔与即时动作、组合、缓动和控制 | 用动作或 Tween 驱动节点属性，并能解释它如何进入每帧更新 |
| 八：UI 结构与交互 | 35–39（第 35–39 课已完成） | Canvas、Widget、Layout、Label、Button | 建立可适配屏幕、可排布、可显示文本并可交互的基础 UI |
| 九：音频 | 40–42（第 40–42 课已完成） | 资源、播放生命周期、并发与音量控制 | 加载并播放音效或背景音，观察播放、停止和资源生命周期 |
| 十：2D 物理 | 43–46（第 43–46 课已完成） | 物理世界、刚体与碰撞体、接触、查询与调试 | 让节点参与 2D 模拟并处理碰撞或查询结果 |
| 十一：2D 粒子 | 47–49（第 47–49 课已完成） | 粒子系统创建、发射与模拟、渲染和结束 | 从配置生成粒子，观察其更新、绘制与回收 |
| 十二：构建、打包与交付 | 50–53（第 50–53 课已完成） | 目标配置、代码/资源构建、产物结构、启动与交付 | 从工程配置追到可运行的 Web 目录或原生应用包 |
| 十三：Web 缓存与版本更新 | 54（第 54 课已完成） | 浏览器缓存重验证、版本化资源 URL、发布切换与回滚 | 让入口发现新版本，并复用不可变资源 |
| 十四：Creator 3D 物理 | 55（第 55 课已完成） | Director 接入 3D 物理系统、World 固定步进 | 观察每帧时间如何变成物理子步 |
| 十五：Creator 渲染系统深化 | 56–65（已完成） | Camera 与可见性、渲染数据、材质和着色器、缓冲区、2D 合批、3D 模型、管线提交与离屏渲染 | 2.4 用 Camera FrameBuffer；3.8 用 Camera/RenderWindow/GFX Framebuffer |
| 十六：Cocos2d-x 渲染深化 | 56–65（已完成） | 相机、可见性与排序、Sprite 数据、GPU 缓冲、渲染状态、程序与参数、合批、3D 边界、设备提交与 RenderTexture | 1.x/2.x 手动 GL FBO 作用域；3.x 队列回调绑定 GL FBO；4.0 通过 backend render pass 附件 |
| 十七：3D 物理深化 | 66–70（已完成） | 刚体、形状、过滤、查询和约束边界 | Creator 2.4/3.8 与 Cocos2d-x 3.x/4.0；x1/x2 无内置模块 |
| 十八：动画播放与状态 | 71–75（已完成） | 片段、播放、采样、事件、切换 | 六个版本独立实现，按各自帧动画、Action、Animation 或骨骼系统讲解 |
| 十九：3D 粒子 | 76–80（已完成） | 发射、模拟、粒子模块、渲染和生命周期 | Creator 2.4/3.8 与 Cocos2d-x 3.x/4.0；x1/x2 无内置模块 |

### 七：Action / Tween（第 30–34 课，第 30–34 课已完成）

1. **动作更新链（第 30 课已完成）**：目标对象、动作管理器和逐帧推进之间的关系。[Creator 2.4.15](../learn_2.4cocoscreator/s30_action_update_chain/README.md)和[Creator 3.8.7](../learn_3.8cocoscreator/s30_action_update_chain/README.md)各有独立示例；Cocos2d-x 1.x、2.x、3.x、4.x 已由各自第 6 课覆盖，索引分别指向[1.x](../learn_cocos2d-1x/s06_action_scheduler/README.md)、[2.x](../learn_cocos2d-2x/s06_action_scheduler/README.md)、[3.x](../learn_cocos2d-3x/s06_action_scheduler/README.md)、[4.x](../learn_cocos2d-4x/s06_action_scheduler/README.md)的独立代码。
2. **时间动作（第 31 课已完成）**：持续时间、归一化进度与绝对目标插值；Cocos2d-x 1.x 直接插值，2.x–4.x 由 MoveTo 计算位移并复用 MoveBy。
3. **即时与延迟动作（第 32 课已完成）**：回调、延迟和完成时机；Cocos2d-x 1.x 在 `startWithTarget` 同步执行 CallFunc，Creator 2.4、3.8 和 Cocos2d-x 2.x–4.x 在动作更新时执行。
4. **动作组合（第 33 课已完成）**：Sequence 串行动作、Spawn 并行动作、较短分支补时，以及 Tween 链式组合入口。
5. **动作进度修饰（第 34 课已完成）**：缓动、重复和反向时间；ActionManager 暂停/恢复、动作停止与 cleanup 放在动作管理器和 Node 生命周期专题理解。

Cocos2d-x 1.x–4.x 的第 6 课已实现 ActionManager、基础间隔动作和 MoveBy；后续只补未覆盖的组合与控制机制。Creator 2.4.15 以 Action/Tween 源码为依据，Creator 3.8.7 以 Tween 系统为依据。

源码入口：Creator 2.4.15 `engine/2.4.15engine/cocos2d/actions/CCActionManager.js`、`CCActionInterval.js`、`tween.js`；Creator 3.8.7 `engine/3.8.7engine/cocos/tween/`；Cocos2d-x 各版本的 `actions/` 或 `cocos/2d/`。

### 八：UI 结构与交互（第 35–39 课，第 35–39 课已完成）

1. **Canvas 与屏幕坐标（第 35 课已完成）**：设计分辨率、视图和 UI 根节点如何接起来。六个版本分别维护独立示例：[Creator 2.4.15](../learn_2.4cocoscreator/s35_canvas_coordinates/README.md)、[Creator 3.8.7](../learn_3.8cocoscreator/s35_canvas_coordinates/README.md)、[Cocos2d-x 1.x](../learn_cocos2d-1x/s35_canvas_coordinates/README.md)、[2.x](../learn_cocos2d-2x/s35_canvas_coordinates/README.md)、[3.x](../learn_cocos2d-3x/s35_canvas_coordinates/README.md)、[4.x](../learn_cocos2d-4x/s35_canvas_coordinates/README.md)。
2. **Widget 对齐（第 36 课已完成）**：锚点、父节点尺寸和窗口变化如何影响位置。六个版本分别维护独立示例：[Creator 2.4.15](../learn_2.4cocoscreator/s36_widget_alignment/README.md)、[Creator 3.8.7](../learn_3.8cocoscreator/s36_widget_alignment/README.md)、[Cocos2d-x 1.x](../learn_cocos2d-1x/s36_widget_alignment/README.md)、[2.x](../learn_cocos2d-2x/s36_widget_alignment/README.md)、[3.x](../learn_cocos2d-3x/s36_widget_alignment/README.md)、[4.x](../learn_cocos2d-4x/s36_widget_alignment/README.md)。
3. **Layout 水平排布（第 37 课已完成）**：子节点顺序、间距、边距与布局刷新时机。六个版本分别维护独立示例：[Creator 2.4.15](../learn_2.4cocoscreator/s37_layout/README.md)、[Creator 3.8.7](../learn_3.8cocoscreator/s37_layout/README.md)、[Cocos2d-x 1.x](../learn_cocos2d-1x/s37_layout/README.md)、[2.x](../learn_cocos2d-2x/s37_layout/README.md)、[3.x](../learn_cocos2d-3x/s37_layout/README.md)、[4.x](../learn_cocos2d-4x/s37_layout/README.md)。
4. **Label 文本更新（第 38 课已完成）**：文本变化如何进入尺寸计算与绘制数据。六个版本分别维护独立示例：[Creator 2.4.15](../learn_2.4cocoscreator/s38_label_update/README.md)、[Creator 3.8.7](../learn_3.8cocoscreator/s38_label_update/README.md)、[Cocos2d-x 1.x](../learn_cocos2d-1x/s38_label_update/README.md)、[2.x](../learn_cocos2d-2x/s38_label_update/README.md)、[3.x](../learn_cocos2d-3x/s38_label_update/README.md)、[4.x](../learn_cocos2d-4x/s38_label_update/README.md)。
5. **Button 交互（第 39 课已完成）**：输入命中如何驱动按下状态，并在释放时调用业务回调。六个版本分别维护独立示例：[Creator 2.4.15](../learn_2.4cocoscreator/s39_button_interaction/README.md)、[Creator 3.8.7](../learn_3.8cocoscreator/s39_button_interaction/README.md)、[Cocos2d-x 1.x](../learn_cocos2d-1x/s39_button_interaction/README.md)、[2.x](../learn_cocos2d-2x/s39_button_interaction/README.md)、[3.x](../learn_cocos2d-3x/s39_button_interaction/README.md)、[4.x](../learn_cocos2d-4x/s39_button_interaction/README.md)。

Creator 源码入口：2.4.15 `cocos2d/core/components/CCCanvas.js`、`CCWidget.js`、`CCLayout.js`、`CCLabel.js`、`CCButton.js`，以及 `cocos2d/core/base-ui/CCWidgetManager.js`；3.8.7 `cocos/2d/framework/canvas.ts`、`cocos/ui/widget.ts`、`widget-manager.ts`、`layout.ts`、`cocos/2d/components/label.ts`、`cocos/ui/button.ts`。

Cocos2d-x 使用本版本实际提供的 `Layer`、`Menu`、`Label` 或 `ui::Widget` 等结构。旧版本没有 Creator 式 Canvas/Widget 组件时，记录其真实入口和缺失边界，不强行补齐同名课程实现。

### 九：音频（第 40–42 课）

1. **音频资源与引擎入口（第 40 课已完成）**：资源如何交给平台音频后端。六个版本各有独立示例：[Creator 2.4.15](../learn_2.4cocoscreator/s40_audio_resource_entry/README.md)、[Creator 3.8.7](../learn_3.8cocoscreator/s40_audio_resource_entry/README.md)、[Cocos2d-x 1.x](../learn_cocos2d-1x/s40_audio_resource_entry/README.md)、[2.x](../learn_cocos2d-2x/s40_audio_resource_entry/README.md)、[3.x](../learn_cocos2d-3x/s40_audio_resource_entry/README.md)、[4.x](../learn_cocos2d-4x/s40_audio_resource_entry/README.md)。
2. **播放生命周期（第 41 课已完成）**：播放、暂停、恢复、停止和自然结束。六个版本各有独立示例：[Creator 2.4.15](../learn_2.4cocoscreator/s41_audio_playback_lifecycle/README.md)、[Creator 3.8.7](../learn_3.8cocoscreator/s41_audio_playback_lifecycle/README.md)、[Cocos2d-x 1.x](../learn_cocos2d-1x/s41_audio_playback_lifecycle/README.md)、[2.x](../learn_cocos2d-2x/s41_audio_playback_lifecycle/README.md)、[3.x](../learn_cocos2d-3x/s41_audio_playback_lifecycle/README.md)、[4.x](../learn_cocos2d-4x/s41_audio_playback_lifecycle/README.md)。旧版 SimpleAudioEngine 没有通用音效完成回调，课程会注明该 API 边界。
3. **并发与控制（第 42 课已完成）**：背景音和音效的音量、循环、并发及实例释放。六个版本各有独立示例：[Creator 2.4.15](../learn_2.4cocoscreator/s42_audio_concurrency_control/README.md)、[Creator 3.8.7](../learn_3.8cocoscreator/s42_audio_concurrency_control/README.md)、[Cocos2d-x 1.x](../learn_cocos2d-1x/s42_audio_concurrency_control/README.md)、[2.x](../learn_cocos2d-2x/s42_audio_concurrency_control/README.md)、[3.x](../learn_cocos2d-3x/s42_audio_concurrency_control/README.md)、[4.x](../learn_cocos2d-4x/s42_audio_concurrency_control/README.md)。按版本说明音量分组、并发上限和资源回收差异。

源码入口：Creator 2.4.15 `cocos2d/core/components/CCAudioSource.js`、`cocos2d/audio/CCAudioEngine.js`、`CCAudio.js`；Creator 3.8.7 `cocos/audio/audio-downloader.ts`、`audio-source.ts`、`pal/audio/web/player.ts`；Cocos2d-x 1.x–2.x `CocosDenshion/`，3.x–4.x `cocos/audio/` 和各平台 `AudioEngineImpl`。按版本和目标平台分别说明后端差异。

### 十：2D 物理（第 43–46 课，已完成）

1. **物理世界（第 43 课已完成）**：世界创建、启用、时间步进和场景更新顺序。六个版本各有独立示例：[Creator 2.4.15](../learn_2.4cocoscreator/s43_physics_world/README.md)、[Creator 3.8.7](../learn_3.8cocoscreator/s43_physics_world/README.md)、[Cocos2d-x 1.x](../learn_cocos2d-1x/s43_physics_world/README.md)、[2.x](../learn_cocos2d-2x/s43_physics_world/README.md)、[3.x](../learn_cocos2d-3x/s43_physics_world/README.md)、[4.x](../learn_cocos2d-4x/s43_physics_world/README.md)。1.x/2.x 由应用层接入独立 Box2D；Creator 与 Cocos2d-x 3.x/4.x 展示引擎自己的 2D 物理接线。
2. **刚体与碰撞体（第 44 课已完成）**：静态/动态刚体、形状和材质如何映射到节点。六个版本各有独立示例：[Creator 2.4.15](../learn_2.4cocoscreator/s44_rigidbody_collider/README.md)、[Creator 3.8.7](../learn_3.8cocoscreator/s44_rigidbody_collider/README.md)、[Cocos2d-x 1.x](../learn_cocos2d-1x/s44_rigidbody_collider/README.md)、[2.x](../learn_cocos2d-2x/s44_rigidbody_collider/README.md)、[3.x](../learn_cocos2d-3x/s44_rigidbody_collider/README.md)、[4.x](../learn_cocos2d-4x/s44_rigidbody_collider/README.md)。1.x/2.x 由应用直接使用 Box2D；3.x/4.x 的 `PhysicsBody` 通过 Node 组件机制进入 `PhysicsWorld`。
3. **接触与过滤（第 45 课已完成）**：碰撞过滤决定是否生成接触；监听开关和通知掩码决定是否派发回调；PreSolve 可以临时改变本步响应。六版独立示例：[Creator 2.4.15](../learn_2.4cocoscreator/s45_contact_filter/README.md)、[Creator 3.8.7](../learn_3.8cocoscreator/s45_contact_filter/README.md)、[Cocos2d-x 1.x](../learn_cocos2d-1x/s45_contact_filter/README.md)、[2.x](../learn_cocos2d-2x/s45_contact_filter/README.md)、[3.x](../learn_cocos2d-3x/s45_contact_filter/README.md)、[4.x](../learn_cocos2d-4x/s45_contact_filter/README.md)。1.x/2.x 使用随仓库提供的独立 Box2D；Creator 使用 Box2D；Cocos2d-x 3.x/4.x 使用 Chipmunk。
4. **查询与调试（第 46 课已完成）**：射线、区域查询和调试绘制。六版独立示例：[Creator 2.4.15](../learn_2.4cocoscreator/s46_physics_queries/README.md)、[Creator 3.8.7](../learn_3.8cocoscreator/s46_physics_queries/README.md)、[Cocos2d-x 1.x](../learn_cocos2d-1x/s46_physics_queries/README.md)、[2.x](../learn_cocos2d-2x/s46_physics_queries/README.md)、[3.x](../learn_cocos2d-3x/s46_physics_queries/README.md)、[4.x](../learn_cocos2d-4x/s46_physics_queries/README.md)。Creator 查询经 PhysicsManager/PhysicsSystem2D 转发到 Box2D；Cocos2d-x 1.x/2.x 由应用直接查询 Box2D；3.x/4.x 由 PhysicsWorld 查询 Chipmunk。

首轮只覆盖 2D 物理。Creator 2.4.15 入口为 `cocos2d/core/physics/CCPhysicsManager.js`、`CCRigidBody.js`；Creator 3.8.7 为 `cocos/physics-2d/framework/physics-system.ts`、`components/rigid-body-2d.ts`；Cocos2d-x 1.x–2.x 在应用层直接使用仓库附带的独立 Box2D；3.x–4.x 查看各自 `cocos/physics/` 和 Chipmunk 后端。

### 十一：2D 粒子（第 47–49 课，已完成）

1. **粒子系统创建（第 47 课已完成）**：发射器配置、贴图和粒子数据从哪里进入运行时。六版独立示例：[Creator 2.4.15](../learn_2.4cocoscreator/s47_particle_system/README.md)、[Creator 3.8.7](../learn_3.8cocoscreator/s47_particle_system/README.md)、[Cocos2d-x 1.x](../learn_cocos2d-1x/s47_particle_system/README.md)、[2.x](../learn_cocos2d-2x/s47_particle_system/README.md)、[3.x](../learn_cocos2d-3x/s47_particle_system/README.md)、[4.x](../learn_cocos2d-4x/s47_particle_system/README.md)。
2. **粒子模拟（第 48 课已完成）**：发射、寿命、速度和每帧状态更新。六版独立示例：[Creator 2.4.15](../learn_2.4cocoscreator/s48_particle_simulation/README.md)、[Creator 3.8.7](../learn_3.8cocoscreator/s48_particle_simulation/README.md)、[Cocos2d-x 1.x](../learn_cocos2d-1x/s48_particle_simulation/README.md)、[2.x](../learn_cocos2d-2x/s48_particle_simulation/README.md)、[3.x](../learn_cocos2d-3x/s48_particle_simulation/README.md)、[4.x](../learn_cocos2d-4x/s48_particle_simulation/README.md)。
3. **粒子绘制与结束（第 49 课已完成）**：观察活动粒子转成顶点/索引或 quad 命令，再沿停止、排空和自动移除结束生命周期。六版独立示例：[Creator 2.4.15](../learn_2.4cocoscreator/s49_particle_render_finish/README.md)、[Creator 3.8.7](../learn_3.8cocoscreator/s49_particle_render_finish/README.md)、[Cocos2d-x 1.x](../learn_cocos2d-1x/s49_particle_render_finish/README.md)、[2.x](../learn_cocos2d-2x/s49_particle_render_finish/README.md)、[3.x](../learn_cocos2d-3x/s49_particle_render_finish/README.md)、[4.x](../learn_cocos2d-4x/s49_particle_render_finish/README.md)。

源码入口：Creator 2.4.15 `cocos2d/particle/CCParticleSystem.js`；Creator 3.8.7 `cocos/particle-2d/particle-system-2d.ts`、`particle-simulator-2d.ts`；Cocos2d-x 1.x–2.x `cocos2dx/particle_nodes/`，3.x–4.x `cocos/2d/CCParticleSystem.*`。首轮关注 2D 粒子，3D 粒子另列专题。

### 十二：构建、打包与交付（第 50–53 课，已完成）

1. **目标与构建入口（第 50 课已完成）**：先固定版本、目标平台、Debug/Release 模式和工程入口。六版独立示例：[Creator 2.4.15](../learn_2.4cocoscreator/s50_build_target_entry/README.md)、[Creator 3.8.7](../learn_3.8cocoscreator/s50_build_target_entry/README.md)、[Cocos2d-x 1.x](../learn_cocos2d-1x/s50_build_target_entry/README.md)、[2.x](../learn_cocos2d-2x/s50_build_target_entry/README.md)、[3.x](../learn_cocos2d-3x/s50_build_target_entry/README.md)、[4.x](../learn_cocos2d-4x/s50_build_target_entry/README.md)。Creator 3.8.7 只做源码映射和课程示例，不做编辑器构建/运行验收。
2. **代码与引擎构建（第 51 课已完成）**：Creator 2.4.15 用 Browserify 等工具生成引擎 bundle；Creator 3.8.7 以内部构建常量选择运行时分支；Cocos2d-x 1.x–2.x 由 Make 生成引擎库并链接游戏，3.x–4.x 由 CMake 组织引擎和游戏目标。六版独立示例：[Creator 2.4.15](../learn_2.4cocoscreator/s51_code_engine_build/README.md)、[Creator 3.8.7](../learn_3.8cocoscreator/s51_code_engine_build/README.md)、[Cocos2d-x 1.x](../learn_cocos2d-1x/s51_code_engine_build/README.md)、[2.x](../learn_cocos2d-2x/s51_code_engine_build/README.md)、[3.x](../learn_cocos2d-3x/s51_code_engine_build/README.md)、[4.x](../learn_cocos2d-4x/s51_code_engine_build/README.md)。Creator 3.8.7 仅静态映射，不做编辑器构建或运行验收。
3. **资源处理与产物结构（第 52 课已完成）**：Creator Bundle 元数据映射导入/原生文件地址；Cocos2d-x 1.x/2.x 从 `Resources` 与搜索路径定位文件，3.x 复制资源，4.x 通过同步目标更新运行目录。六版独立示例：[Creator 2.4.15](../learn_2.4cocoscreator/s52_resource_artifacts/README.md)、[Creator 3.8.7](../learn_3.8cocoscreator/s52_resource_artifacts/README.md)、[Cocos2d-x 1.x](../learn_cocos2d-1x/s52_resource_artifacts/README.md)、[2.x](../learn_cocos2d-2x/s52_resource_artifacts/README.md)、[3.x](../learn_cocos2d-3x/s52_resource_artifacts/README.md)、[4.x](../learn_cocos2d-4x/s52_resource_artifacts/README.md)。Creator 完整编辑器资源导入/构建流程不在本地引擎源码中；Creator 3.8.7 仅做静态映射。
4. **启动与交付（第 53 课已完成）**：Creator 2.4 Web 从静态入口进入 cc.game.run，初始化回调加载启动场景；入口更新和版本化资源缓存属于部署策略。Creator 3.8.7 只静态映射 Game.init、Game.run 与首帧加载场景回调。Cocos2d-x 1.x–4.x 从平台 main 进入 Application，再由 AppDelegate 启动首个 Scene，原生 app 与资源随平台目标交付。六版独立示例：[Creator 2.4.15](../learn_2.4cocoscreator/s53_startup_delivery/README.md)、[Creator 3.8.7](../learn_3.8cocoscreator/s53_startup_delivery/README.md)、[Cocos2d-x 1.x](../learn_cocos2d-1x/s53_startup_delivery/README.md)、[2.x](../learn_cocos2d-2x/s53_startup_delivery/README.md)、[3.x](../learn_cocos2d-3x/s53_startup_delivery/README.md)、[4.x](../learn_cocos2d-4x/s53_startup_delivery/README.md)。

Creator 2.4.15 首轮只研究与 Web 浏览器目标一致的构建输出。Creator 的完整 Editor Builder 不在本地引擎源码中；课程从公开构建入口、引擎宏/启动代码和可检查的输出分别说明证据，不能声称还原闭源 Builder 的全部步骤。Creator 3.8.7 暂列在总纲，当前不执行构建或实机验收。

### 十三：Web 缓存与版本更新（第 54 课，已完成）

Creator 2.4.15 追踪 Config 和 URL Transformer 如何组成带版本的资源 URL，并用可重新验证的发布清单切换到新版本目录；Nginx 示例为版本目录设置长缓存，旧目录用于回滚。Creator 3.8.7 仅做同类源码静态映射和课程代码示例，不执行编辑器构建或实机验收。两版课程各有独立代码：[Creator 2.4.15](../learn_2.4cocoscreator/s54_web_cache_versioning/README.md)、[Creator 3.8.7](../learn_3.8cocoscreator/s54_web_cache_versioning/README.md)。Cocos2d-x 1.x–4.x 面向原生应用和资源交付，不纳入浏览器 HTTP 缓存专题。

### 十四：Creator 3D 物理（第 55 课，已完成）

Creator 2.4.15 从 Director 调度进入 `Physics3DManager`，以默认固定步长调用选定的 `PhysicsWorld`；本课代码模拟 Cannon World 的同步、步进和事件顺序。Creator 3.8.7 从 Director 初始化后的 `PhysicsSystem` 注册，沿 `postUpdate` 的累积器和最大子步数推进 World；这里只做静态源码映射与独立课程代码，不执行编辑器构建或实机验收。两版代码分别见 [Creator 2.4.15](../learn_2.4cocoscreator/s55_physics3d_world_step/README.md) 和 [Creator 3.8.7](../learn_3.8cocoscreator/s55_physics3d_world_step/README.md)。

Cocos2d-x 1.x–4.x 分别沿各自版本的工程模板、构建脚本、平台入口和资源目录追踪；不能把 4.x 的 CMake 路径套到旧版。第一轮每版只选有明确工具链和输出证据的一个目标平台，其他平台另列，不从一次桌面构建推断移动端或商店包状态。

源码和研究入口：Creator 2.4.15 `engine/2.4.15engine/gulp/util/utils.js`、`predefine.js`、`cocos2d/core/CCGame.js`、`CCSys.js`，以及 [发布与原生研究](2.x/10-publishing-and-native.md)；该引擎目录不包含完整 Creator Builder。Cocos2d-x 4.x 从 `engine/cocos2d-x-4/templates/cpp-template-default/`、CMake 配置和[项目构建边界](cocos2d-x-creator2x-source-study-plan.md)入手；该仓库当前 macOS x86_64 构建证据不能外推到其他平台。其他版本在对应课程 README 中列明本地版本源码和平台工程入口。

### 十五：Creator 渲染系统深化（第 56–65 课已完成）

Creator 2.4.15 的第 10–13 课已经搭出最小 Sprite 绘制链；新阶段继续追踪更完整的 Web 渲染职责，不重复四边形与 UV 入门。Creator 2.4.15 以 Web 浏览器路径实现；Creator 3.8.7 按其源码结构做独立示例和静态映射，不强行套用 2.4 的类名。第 59 课分别沿 2.4 MeshBuffer.uploadData → WebGL VB/IB → InputAssembler，以及 3.8 LinearBufferAccessor → MeshBuffer → GFX Buffer 路径；两课共享概念，但接口和对象职责不合并。

| 课 | 新增主题 | 阶段结果 |
| --- | --- | --- |
| 56 | Camera、视口与渲染视图 | 说明相机配置如何形成一次渲染视图 |
| 57 | 相机可见性裁剪与排序 | 对照 Creator 2.4 的 View/stage 与 3.8 的 SceneCulling/RenderQueue |
| 58 | Sprite 几何数据更新 | 对照 2.4 assembler/RenderFlow 与 3.8 UIRendererManager/Batcher2D |
| 59 | 顶点/索引缓冲与 GPU 上传 | 分别追踪 Creator 2.4 WebGL VB/IB 与 3.8 GFX Buffer 更新路径 |
| 60 | 材质与绘制状态 | 2.4 展示 Effect/Technique/Pass 到 WebGL；3.8 展示 Renderer 按需创建 MaterialInstance 并覆盖 Pass 状态 |
| 61 | ProgramLib 宏变体、Shader 属性与 Uniform | 2.4 沿 ProgramLib 到 WebGL 程序与 Pass 属性；3.8 沿 ProgramLib 到 GFX Shader 和 WebGL2 惰性程序创建，各有独立代码 |
| 62 | 2D/UI 合批与 flush 条件 | 2.4 沿 ModelBatcher/材质哈希/cullingMask/MeshBuffer 容量；3.8 沿 Batcher2D/RenderData dataHash/Material/stencil stage，各有独立代码 |
| 63 | MeshRenderer 与网格提交路径 | 2.4 由 MeshRendererAssembler 遍历子网格并写 MeshBuffer/InputAssembler；3.8 由 ModelRenderer 建立 Model/SubModel 并挂入 RenderScene，各按本版源码实现 |
| 64 | 渲染管线到图形 API 提交 | Creator 2.4 沿 ForwardRenderer/BaseRenderer 直接调用 WebGL Device；3.8 默认管线沿 Root/RenderPipeline/ForwardStage 到 GFX，WebGL2 PrimaryCommandBuffer.draw 即时发 GL 调用 |
| 65 | Camera 离屏目标与后续采样 | Creator 2.4 Camera 将 GFX FrameBuffer 交给 View；3.8 Camera 切换到 RenderTexture.window，RenderWindow 提供 GFX Framebuffer/颜色纹理，各自保持本版入口 |

每课的版本专属源码路径和实现边界见 [Creator 2.4.15 课程大纲](../learn_2.4cocoscreator/课程大纲.md) 与 [Creator 3.8.7 课程大纲](../learn_3.8cocoscreator/课程大纲.md)；专题资料见 [2.4.15 图形渲染](2.x/06-graphics-rendering.md) 与 [3.8.7 图形渲染](3.x/06-graphics-rendering.md)。

### 十六：Cocos2d-x 渲染深化（第 56–65 课已完成）

Cocos2d-x 1.x–4.x 的第 10–13 课已覆盖场景访问、可见性/排序、Sprite 几何和纹理区域。深化阶段沿各版本自己的源码继续：1.x/2.x 主要是 Node 访问期间直接调用 OpenGL；3.x 引入 Renderer 与渲染命令队列；4.0 再把命令提交接到可替换的渲染后端。相同课号表示主题并行，代码和 API 按版本分别维护。

| 课 | 新增主题 | 阶段结果 |
| --- | --- | --- |
| 56 | Camera、视口与投影矩阵 | 追踪 Director/GLView 到相机坐标和最终视口 |
| 57 | Node 访问顺序与相机过滤 | 对照旧版直接遍历绘制与 3.x/4.0 的相机筛选、GlobalZ 命令队列 |
| 58 | Sprite 几何属性更新 | 对照 1.x/2.x quad 与 TextureAtlas、3.x/4.0 三角形命令输入 |
| 59 | 顶点/索引数据进入各版本图形缓冲 | 说明各版本如何从 CPU 图元进入各自的 OpenGL 或 backend 缓冲 |
| 60 | 各版本绘制状态 | 1.x/2.x 沿 Sprite 直接绘制；3.x 沿继承式 RenderState；4.0 合并 StateBlock 到 backend PipelineDescriptor |
| 61 | 程序对象与 Uniform 参数 | 1.x 固定管线输入边界；2.x CCShaderCache/CCGLProgram；3.x GLProgramState/UniformValue；4.0 backend ProgramCache/ProgramState，各自按本版源码实现 |
| 62 | 2D 合批与批次边界 | 1.x 同纹理 quad 插入 TextureAtlas；2.x 按 zOrder 重排 atlas quad；3.x 封装为 BatchCommand；4.0 按 material ID 合并相邻三角形命令，各自走本版渲染路径 |
| 63 | 网格输入与提交边界 | 1.x CCGrid3D 固定管线变形纹理网格；2.x CCGrid3D 加 Shader 后仍直接绘制；3.x Sprite3D/Mesh 生成 GL MeshCommand；4.0 按 Material Pass 生成 backend MeshCommand，各自沿本版渲染路径 |
| 64 | 各版本的图形 API 提交 | 1.x/2.x Node.visit 中 Sprite 直接调用 OpenGL；3.x Renderer 排序并执行 GL MeshCommand；4.0 Renderer 经 backend CommandBuffer 调用对应 GL/Metal 实现 |
| 65 | 各版离屏目标与回屏绘制 | 1.x/2.x begin/end 手动绑定 FBO；3.x begin/end 排入 Group/Callback 命令后直接绑定 GL FBO；4.0 回调更新 RenderPassDescriptor 并由 backend CommandBuffer 应用附件 |

每课的源码入口见 [Cocos2d-x 1.x](../learn_cocos2d-1x/课程大纲.md)、[2.x](../learn_cocos2d-2x/课程大纲.md)、[3.x](../learn_cocos2d-3x/课程大纲.md) 与 [4.0](../learn_cocos2d-4x/课程大纲.md) 大纲。

第 59 课明确保留四条演进路线：1.x TextureAtlas 的 CC_USES_VBO 分支，2.x TextureAtlas 的 VAO/VBO 脏数据上传，3.x Renderer 的共享 staging 数组与 GL Buffer，4.0 Renderer 经 backend Buffer 更新数据。

## 第 65 课之后已完成课程

第 66–80 课均已按版本源码实现独立示例；相同课号只组织学习主题，不表示各版本使用相同 API。课程入口和本版源码位置见六条课程大纲。

### 十七：3D 物理深化（第 66–70 课，已完成）

| 课 | 主题 | 核心问题 |
| --- | --- | --- |
| 66 | 刚体生命周期与节点同步 | 刚体何时加入物理世界，模拟结果如何回写节点变换？ |
| 67 | 碰撞体形状与物理材质 | 节点上的形状、缩放和材质如何变成物理形状？ |
| 68 | 接触、触发与碰撞过滤 | 接触如何产生，过滤条件如何影响触发器和回调？ |
| 69 | 射线查询与命中检查 | 如何从场景发起射线，并检查命中的物理对象？ |
| 70 | 约束与后端能力边界 | 哪些版本提供 3D 约束，组件如何把约束注册到物理世界？ |

版本范围：Creator 2.4.15 `cocos2d/core/3d/physics/`、Creator 3.8.7 `cocos/physics/`、Cocos2d-x 3.x/4.0 `cocos/physics3d/`。Creator 各自说明可选后端；Creator 2.4.15 没有引擎级 3D 约束组件，Creator 3.8.7 与 Cocos2d-x 3.x/4.0 有约束接口。Cocos2d-x 1.x/2.x 的快照没有对应的引擎内置 3D 物理模块，只记录版本边界，不补造同名实现。Creator 2.4.15 和 3.8.7 的世界步进入口已由第 55 课介绍。

### 十八：动画播放与状态（第 71–75 课，已完成）

| 课 | 主题 | 核心问题 |
| --- | --- | --- |
| 71 | 动画资源与片段 | 各版本的动画数据如何进入运行时播放器？ |
| 72 | 播放状态与时间推进 | 播放、暂停、循环和结束如何进入每帧更新？ |
| 73 | 关键帧采样与属性写回 | 时间如何转换成节点属性或骨骼姿态？ |
| 74 | 动画事件与完成回调 | 关键时刻和播放结束如何通知游戏逻辑？ |
| 75 | 状态切换、混合与版本边界 | 多段动画如何组合；哪些版本使用骨骼动画或状态图？ |

版本范围：Creator 2.4.15 `cocos2d/animation/`、Creator 3.8.7 `cocos/animation/`；Cocos2d-x 1.x/2.x 从各自 `CCAnimation` 帧动画和动作组合讲起，3.x/4.0 再沿本版 `Animation3D`、`Skeleton3D` 等源码扩展。课程按每版实际能力说明差异，不把新版本的动画状态图概念套给旧版。

### 十九：3D 粒子（第 76–80 课，已完成）

| 课 | 主题 | 核心问题 |
| --- | --- | --- |
| 76 | 粒子系统配置与发射器 | 配置和发射形状如何创建粒子？ |
| 77 | 粒子模拟与生命周期 | 粒子如何逐帧更新并到期回收？ |
| 78 | 速度、力与颜色曲线 | 随时间变化的模块如何修改粒子状态？ |
| 79 | 粒子渲染与批次 | 活动粒子如何变成各版本自己的渲染数据和绘制提交？ |
| 80 | 停止、排空与资源回收 | 停止发射后如何处理存活粒子和渲染资源？ |

版本范围：Creator 2.4.15 `cocos2d/core/3d/particle/`、Creator 3.8.7 `cocos/particle/`、Cocos2d-x 3.x/4.0 `extensions/Particle3D/`。Creator 3.8.7 的 CPU/GPU 粒子实现单独追踪；Cocos2d-x 1.x/2.x 已在第 47–49 课覆盖其 2D 粒子，本地源码中没有对应的 3D 粒子模块，不为保持课号一致而虚构实现。

### 后续专题：平台与运行时专项

第 50–53 课已覆盖通用构建、资源产物和启动交付。后续可按需要选择 Web、桌面、移动端或原生专项；开始前先选定引擎补丁版本、目标平台和工具链，再按实际源码与可运行证据确定主题，避免重复讲通用打包流程。

## 课程落地规则

- 各版本从自己的课程大纲和源码路径继续；规划课号用于组织主题，源码已有的基础行为不重复讲解。
- 新课开始前先核对对应版本的实际源文件、关键调用和支持平台，再固定课名与代码边界。
- Creator 课程继续以 Web 浏览器运行时为主；引擎源码路径或模拟结果不表述为编辑器/目标平台验收。
- 打包课程先固定引擎补丁版、目标平台、构建模式和工程身份；运行构建前核对工具链与 SDK，下载依赖、安装工具或改全局环境前先取得授权。
- 构建日志、生成物检查和目标运行时验收分开记录；未实际构建的平台保持未验证状态。
- 每个课程 README 记录本课目标、源码文件与关键函数、独立代码入口、可观察结果和简化点。
- 第 66–80 课已完成：3D 物理、动画与 3D 粒子；Cocos2d-x 1.x/2.x 不含 3D 物理和 3D 粒子引擎模块，因此对应课次只记录源码能力边界，不创建伪实现。

## 各版本课程入口

- [Creator 2.4.15](../learn_2.4cocoscreator/课程大纲.md)
- [Creator 3.8.7](../learn_3.8cocoscreator/课程大纲.md)
- [Cocos2d-x 1.x](../learn_cocos2d-1x/课程大纲.md)
- [Cocos2d-x 2.x](../learn_cocos2d-2x/课程大纲.md)
- [Cocos2d-x 3.x](../learn_cocos2d-3x/课程大纲.md)
- [Cocos2d-x 4.0](../learn_cocos2d-4x/课程大纲.md)
