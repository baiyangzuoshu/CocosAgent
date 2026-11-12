# Creator 2.4.15 源码学习

从这里开始。课程以 Web 浏览器运行时为目标，用 TypeScript 逐课搭建一份精简实现，重点理解引擎的模块边界和调用顺序。

## 学习方式

1. 按编号打开一课，先看本课要解决的问题。
2. 对照课内列出的 Creator 2.4.15 源码位置。
3. 直接运行本课目录里的独立代码。
4. 按本课说明观察命令行或页面结果。

每课目录都保存一份完整、可运行的代码快照。后一课从前一课增加一层功能，因此既能单独运行，也能看到架构如何逐步长成。代码目录尽量对应 Creator 源码职责，只裁掉当前 Web 路径无关的代码。

## 课程目录

- [课程大纲](课程大纲.md)：完整阶段规划与源码文件索引。
- [运行准备：浏览器宿主](web_host/README.md)：提供后续浏览器运行课使用的最小宿主，不计课次。
- [第 0 课：`.meta` 元数据分析](s00_meta_analysis/README.md)：从贴图元数据追踪主资源和 SpriteFrame UUID。
- [第 1 课：模块装配](s01_module_assembly/README.md)：创建 cc 命名空间并注册第一个模块。
- [第 2 课：游戏启动](s02_game_startup/README.md)：调用 cc.game.run() 并观察引擎启动事件。
- [第 3 课：Director 初始化与主循环](s03_director_loop/README.md)：由 requestAnimationFrame 驱动 Director。
- [第 4 课：节点与场景树](s04_node_scene_tree/README.md)：建立节点父子关系并遍历场景树。
- [第 5 课：本地位置与世界位置](s05_local_world_transform/README.md)：累加父链平移，得到节点的世界位置。
- [第 6 课：场景加载后的节点激活](s06_node_activation/README.md)：由 NodeActivator 递归更新节点的层级激活状态。
- [第 7 课：组件挂载与生命周期](s07_component_lifecycle/README.md)：观察 `onLoad`、`onEnable`、`onDisable` 的调用顺序。
- [第 8 课：组件每帧调度](s08_component_scheduling/README.md)：观察 `start`、`update`、`lateUpdate` 的阶段顺序。
- [第 9 课：资源请求与缓存](s09_asset_loading_cache/README.md)：同一 UUID 的重复请求复用 Asset 对象。
- [第 10 课：Director 到渲染流程](s10_render_entry/README.md)：活动场景进入 RenderFlow。
- [第 11 课：渲染脏标记与世界变换](s11_render_flags_dirty/README.md)：只重算发生变化的节点。
- [第 12 课：四边形几何与 WebGL 提交](s12_sprite_quad/README.md)：把节点组装成 4 个顶点、6 个索引并绘制。
- [第 13 课：SpriteFrame 连接贴图](s13_sprite_frame_texture/README.md)：从图集矩形算出 UV，再由 WebGL 采样贴图。
- [第 14 课：浏览器输入坐标](s14_browser_input/README.md)
- [第 15 课：节点命中与事件回调](s15_node_event_hit/README.md)
- [第 16 课：节点事件传播](s16_event_propagation/README.md)
- [第 17 课：Prefab 实例化](s17_prefab_instantiation/README.md)
- [第 18 课：组件实例与资源共享](s18_component_asset_sharing/README.md)
- [第 19 课：实例挂载与组件生命周期](s19_instance_lifecycle/README.md)：观察 Prefab 加入活动场景后触发组件回调。
- [第 20 课：节点移除与重新挂载](s20_node_detachment/README.md)
- [第 21 课：延迟销毁与 onDestroy](s21_deferred_destruction/README.md)
- [第 22 课：NodePool 节点复用](s22_node_pool/README.md)
- [第 23 课：对象池复用与未命中兜底](s23_pool_reuse_flow/README.md)
- [第 24 课：对象池容量与预热补充](s24_pool_capacity_strategy/README.md)
- [第 25 课：清池与节点存活](s25_pool_clear_lifetime/README.md)
- [第 26 课：对象池中的节点运行状态](s26_pool_runtime_lifecycle/README.md)
- [第 27 课：取出顺序与重复入池保护](s27_pool_order_and_duplicates/README.md)
- [第 28 课：节点池所有权与接收结果](s28_pool_ownership/README.md)
- [第 29 课：对象池关闭与终态](s29_pool_disposal/README.md)
- [第 30 课：动作更新链](s30_action_update_chain/README.md)
- [第 31 课：时间进度与绝对目标插值](s31_absolute_position_interpolation/README.md)
- [第 32 课：即时回调与延迟动作](s32_instant_and_delay_actions/README.md)
- [第 33 课：串行与并行动作](s33_action_composition/README.md)
- [第 34 课：缓动、重复与反向时间](s34_action_modifiers/README.md)
- [第 35 课：Canvas 与屏幕坐标](s35_canvas_coordinates/README.md)
- [第 36 课：Widget 对齐](s36_widget_alignment/README.md)
- [第 37 课：Layout 水平排布](s37_layout/README.md)
- [第 38 课：Label 文本更新](s38_label_update/README.md)
- [第 39 课：Button 触摸与回调](s39_button_interaction/README.md)
- [第 40 课：AudioClip 与浏览器音频引擎](s40_audio_resource_entry/README.md)
- [第 41 课：音频播放生命周期](s41_audio_playback_lifecycle/README.md)
- [第 42 课：音量、循环与并发](s42_audio_concurrency_control/README.md)
- [第 43 课：物理世界启用与帧步进](s43_physics_world/README.md)
- [第 44 课：RigidBody 与 Collider 接线](s44_rigidbody_collider/README.md)
- [第 45 课：碰撞分组、接触回调与响应](s45_contact_filter/README.md)
- [第 46 课：物理查询与调试绘制](s46_physics_queries/README.md)
- [第 47 课：粒子系统创建与配置](s47_particle_system/README.md)
- [第 48 课：粒子发射与逐帧模拟](s48_particle_simulation/README.md)
- [第 49 课：粒子绘制与结束](s49_particle_render_finish/README.md)
- [第 50 课：目标选择与构建入口](s50_build_target_entry/README.md)
- [第 51 课：代码与引擎构建](s51_code_engine_build/README.md)
- [第 52 课：资源处理与产物结构](s52_resource_artifacts/README.md)
- [第 53 课：启动与交付](s53_startup_delivery/README.md)
- [第 54 课：Web 缓存与版本更新](s54_web_cache_versioning/README.md)：重新验证发布清单，并切换版本化资源目录。
- [第 55 课：3D 物理世界与帧步进](s55_physics3d_world_step/README.md)：观察 Director 如何调度 3D PhysicsWorld。
- [第 56 课：Camera 配置转成渲染 View](s56_camera_view/README.md)：沿 2.4 的 RendererCamera、View 和 ForwardRenderer 路径。
- [第 57 课：Camera cullingMask 与绘制阶段](s57_camera_culling_queue/README.md)：按 View 筛选模型，再区分 opaque/transparent 阶段。
- [第 58 课：Sprite assembler 更新 RenderData](s58_sprite_render_data/README.md)：从顶点脏标记追到 RenderFlow 和 Batcher。
- [第 59 课：MeshBuffer 上传顶点与索引](s59_mesh_buffer_upload/README.md)：沿 2.4 的 WebGL VB/IB 与 InputAssembler 路径。
- [第 60 课：Material、Effect 与 Pass](s60_material_effect_pass/README.md)：从 EffectAsset 解析绘制状态，并由 WebGL 应用混合设置。
- [第 61 课：ProgramLib 宏变体与 Uniform](s61_program_lib_variants/README.md)：按 Pass 宏生成并缓存 WebGL 程序，再应用属性参数。
- [第 62 课：ModelBatcher 与 flush 边界](s62_model_batch_flush/README.md)：按材质哈希、裁剪掩码和 MeshBuffer 容量结束批次。
- [第 63 课：MeshRendererAssembler 处理子网格](s63_mesh_renderer_assembler/README.md)：追踪 Mesh 子网格进入 MeshBuffer 或直接提交 InputAssembler。
- [第 64 课：ForwardRenderer 到 WebGL Device](s64_forward_renderer_device/README.md)：追踪阶段绘制项经 BaseRenderer 后直接提交 WebGL。
- [第 65 课：Camera 输出到 RenderTexture](s65_camera_render_texture/README.md)：将 Camera 输出写入 GFX FrameBuffer，再由 Sprite 采样。

## 第 66–80 课：物理、动画与 3D 粒子

- [第 66 课：Creator 2.4.15 刚体生命周期与节点同步](s66_rigidbody_sync/README.md)
- [第 67 课：Creator 2.4.15 碰撞体形状与物理材质](s67_collider_shapes/README.md)
- [第 68 课：Creator 2.4.15 接触事件与碰撞过滤](s68_contact_filter/README.md)
- [第 69 课：Creator 2.4.15 射线与物理查询](s69_physics_queries/README.md)
- [第 70 课：Creator 2.4.15 约束接口与后端能力边界](s70_constraint_boundary/README.md)
- [第 71 课：Creator 2.4.15 动画资源与片段](s71_animation_clip/README.md)
- [第 72 课：Creator 2.4.15 播放状态与时间推进](s72_animation_playback/README.md)
- [第 73 课：Creator 2.4.15 关键帧采样与属性写回](s73_animation_sampling/README.md)
- [第 74 课：Creator 2.4.15 动画事件与完成回调](s74_animation_events/README.md)
- [第 75 课：Creator 2.4.15 动画组合与过渡](s75_animation_transition/README.md)
- [第 76 课：Creator 2.4.15 粒子系统配置与发射器](s76_particle_emission/README.md)
- [第 77 课：Creator 2.4.15 粒子模拟与生命周期](s77_particle_simulation/README.md)
- [第 78 课：Creator 2.4.15 粒子属性模块与曲线](s78_particle_modules/README.md)
- [第 79 课：Creator 2.4.15 粒子渲染与批次](s79_particle_rendering/README.md)
- [第 80 课：Creator 2.4.15 停止发射与资源回收](s80_particle_lifecycle/README.md)

## 代码结构

~~~text
learn_2.4cocoscreator/
├── README.md                  # 课程入口
├── 课程大纲.md
├── web_host/                  # 浏览器宿主准备，不计课次
├── s00_meta_analysis/         # 独立的第 0 课，分析 .meta 和 UUID
│   ├── README.md
│   ├── deno.json
│   ├── samples/
│   └── src/
├── s01_module_assembly/       # 独立的第 1 课工程，含前课功能
│   ├── README.md
│   ├── deno.json
│   ├── index.html
│   └── src/cocos2d/core/      # 镜像 Creator 的模块职责
├── s02_game_startup/          # 独立的第 2 课工程，含前课功能
│   ├── README.md
│   ├── deno.json
│   ├── index.html
│   └── src/cocos2d/core/
├── s03_director_loop/         # 独立的第 3 课工程，含前课功能
    ├── README.md
    ├── deno.json
    ├── index.html
    └── src/cocos2d/core/
├── s04_node_scene_tree/       # 独立的第 4 课工程，含前课功能
    ├── README.md
    ├── deno.json
    ├── index.html
    └── src/cocos2d/core/
├── s05_local_world_transform/ # 独立的第 5 课工程，含前课功能
    ├── README.md
    ├── deno.json
    ├── index.html
    └── src/cocos2d/core/
├── s06_node_activation/       # 独立的第 6 课工程，含前课功能
├── s07_component_lifecycle/   # 独立的第 7 课工程，含前课功能
├── s08_component_scheduling/  # 独立的第 8 课工程，含前课功能
├── s09_asset_loading_cache/   # 独立的第 9 课工程，含前课功能
├── s10_render_entry/          # 独立的第 10 课工程，含前课功能
├── s11_render_flags_dirty/    # 独立的第 11 课工程，含前课功能
├── s12_sprite_quad/           # 独立的第 12 课工程，含前课功能
│   ├── README.md
│   ├── deno.json
│   ├── index.html
│   ├── assets/
│   └── src/cocos2d/core/
├── s13_sprite_frame_texture/  # 独立的第 13 课工程，含前课功能
│   ├── README.md
│   ├── deno.json
│   ├── index.html
│   ├── assets/
│   └── src/cocos2d/core/
├── s14_browser_input/         # 浏览器输入与画布坐标
├── s15_node_event_hit/        # 节点命中与事件回调
├── s16_event_propagation/     # 捕获、目标和冒泡
├── s17_prefab_instantiation/ # Prefab 生成独立节点树
├── s18_component_asset_sharing/ # 组件独立、SpriteFrame 共享
├── s19_instance_lifecycle/     # 实例挂载与组件生命周期
├── s20_node_detachment/        # 节点移除与重新挂载
├── s21_deferred_destruction/ # 延迟销毁与 onDestroy
├── s22_node_pool/           # NodePool 节点复用
├── s23_pool_reuse_flow/ # 对象池复用与未命中兜底
├── s24_pool_capacity_strategy/ # 对象池容量与预热补充
├── s25_pool_clear_lifetime/ # 清池与节点存活
├── s26_pool_runtime_lifecycle/ # 对象池中的节点运行状态
├── s27_pool_order_and_duplicates/ # 取出顺序与重复入池保护
├── s28_pool_ownership/ # 节点池所有权与接收结果
├── s29_pool_disposal/ # 对象池关闭与终态
├── s30_action_update_chain/ # Tween、ActionManager、Scheduler 和 Director 更新链
├── s31_absolute_position_interpolation/ # 时间进度与绝对目标插值
├── s32_instant_and_delay_actions/   # 即时回调与延迟动作
├── s33_action_composition/          # 串行与并行动作
├── s34_action_modifiers/            # 缓动、重复与反向时间
├── s35_canvas_coordinates/          # Canvas 与屏幕坐标
├── s36_widget_alignment/            # Widget 对齐
├── s37_layout/                      # Layout 水平排布
├── s38_label_update/                # Label 文本更新
├── s39_button_interaction/          # Button 触摸与回调
├── s40_audio_resource_entry/  # 第 40 课：AudioClip 进入浏览器音频引擎
├── s41_audio_playback_lifecycle/  # 第 41 课：音频播放生命周期
├── s42_audio_concurrency_control/  # 第 42 课：音量、循环与并发
├── s43_physics_world/  # 第 43 课：启用物理世界与帧步进
├── s44_rigidbody_collider/  # 第 44 课：RigidBody 与 Collider 怎样挂到 Node
├── s45_contact_filter/  # 第 45 课：碰撞分组、接触回调与响应
├── s46_physics_queries/  # 第 46 课：物理查询与调试绘制
├── s47_particle_system/  # 第 47 课：粒子系统创建与配置
├── s48_particle_simulation/  # 第 48 课：粒子发射与逐帧模拟
├── s49_particle_render_finish/  # 第 49 课：粒子绘制与结束
├── s50_build_target_entry/  # 第 50 课：目标选择与构建入口
├── s51_code_engine_build/  # 第 51 课：代码与引擎构建
├── s52_resource_artifacts/  # 第 52 课：资源处理与产物结构
├── s53_startup_delivery/  # 第 53 课：启动与交付
├── s54_web_cache_versioning/  # 第 54 课：Web 缓存与版本更新
├── s55_physics3d_world_step/  # 第 55 课：3D 物理世界与帧步进
├── s56_camera_view/  # 第 56 课：Camera 配置转成渲染 View
├── s57_camera_culling_queue/  # 第 57 课：Camera cullingMask 与绘制阶段
├── s58_sprite_render_data/  # 第 58 课：Sprite assembler 更新 RenderData
├── s59_mesh_buffer_upload/  # 第 59 课：Creator 2.4 MeshBuffer 上传
├── s60_material_effect_pass/  # 第 60 课：Creator 2.4 Material、Effect 与 Pass
├── s61_program_lib_variants/  # 第 61 课：Creator 2.4 ProgramLib 宏变体与 Uniform
├── s62_model_batch_flush/  # 第 62 课：Creator 2.4 ModelBatcher 与 flush 边界
├── s63_mesh_renderer_assembler/  # 第 63 课：Creator 2.4 MeshRendererAssembler 处理子网格
├── s64_forward_renderer_device/  # 第 64 课：Creator 2.4 ForwardRenderer 到 WebGL Device
├── s65_camera_render_texture/  # 第 65 课：Creator 2.4 Camera 输出到 RenderTexture
├── s66_rigidbody_sync/  # 第 66 课：Creator 2.4.15 刚体生命周期与节点同步
├── s67_collider_shapes/  # 第 67 课：Creator 2.4.15 碰撞体形状与物理材质
├── s68_contact_filter/  # 第 68 课：Creator 2.4.15 接触事件与碰撞过滤
├── s69_physics_queries/  # 第 69 课：Creator 2.4.15 射线与物理查询
├── s70_constraint_boundary/  # 第 70 课：Creator 2.4.15 约束接口与后端能力边界
├── s71_animation_clip/  # 第 71 课：Creator 2.4.15 动画资源与片段
├── s72_animation_playback/  # 第 72 课：Creator 2.4.15 播放状态与时间推进
├── s73_animation_sampling/  # 第 73 课：Creator 2.4.15 关键帧采样与属性写回
├── s74_animation_events/  # 第 74 课：Creator 2.4.15 动画事件与完成回调
├── s75_animation_transition/  # 第 75 课：Creator 2.4.15 动画组合与过渡
├── s76_particle_emission/  # 第 76 课：Creator 2.4.15 粒子系统配置与发射器
├── s77_particle_simulation/  # 第 77 课：Creator 2.4.15 粒子模拟与生命周期
├── s78_particle_modules/  # 第 78 课：Creator 2.4.15 粒子属性模块与曲线
├── s79_particle_rendering/  # 第 79 课：Creator 2.4.15 粒子渲染与批次
├── s80_particle_lifecycle/  # 第 80 课：Creator 2.4.15 停止发射与资源回收
├── s81_spine_runtime_compatibility/  # 第 81 课：Creator 2.4.15 Runtime 与导出资源版本兼容
├── s82_spine_data_instance/  # 第 82 课：Creator 2.4.15 SkeletonData、Atlas 与实例所有权
├── s83_spine_animation_state/  # 第 83 课：Creator 2.4.15 AnimationState、轨道与混合
├── s84_spine_pose_update/  # 第 84 课：Creator 2.4.15 帧更新、骨骼层级与约束
├── s85_spine_slots_attachments/  # 第 85 课：Creator 2.4.15 Skin、Slot、Attachment 与绘制顺序
├── s86_spine_mesh_clipping/  # 第 86 课：Creator 2.4.15 网格附件、Deform 与 Clipping
├── s87_spine_render_submission/  # 第 87 课：Creator 2.4.15 引擎渲染接线与批次
└── s88_spine_events_lifecycle/  # 第 88 课：Creator 2.4.15 事件、调试观察与退出清理
~~~

## Spine 2D 骨骼动画（第 81–88 课）

- [第 81 课：Creator 2.4.15 Runtime 与导出资源版本兼容](s81_spine_runtime_compatibility/README.md)
- [第 82 课：Creator 2.4.15 SkeletonData、Atlas 与实例所有权](s82_spine_data_instance/README.md)
- [第 83 课：Creator 2.4.15 AnimationState、轨道与混合](s83_spine_animation_state/README.md)
- [第 84 课：Creator 2.4.15 帧更新、骨骼层级与约束](s84_spine_pose_update/README.md)
- [第 85 课：Creator 2.4.15 Skin、Slot、Attachment 与绘制顺序](s85_spine_slots_attachments/README.md)
- [第 86 课：Creator 2.4.15 网格附件、Deform 与 Clipping](s86_spine_mesh_clipping/README.md)
- [第 87 课：Creator 2.4.15 引擎渲染接线与批次](s87_spine_render_submission/README.md)
- [第 88 课：Creator 2.4.15 事件、调试观察与退出清理](s88_spine_events_lifecycle/README.md)

Creator 课程以 Web 浏览器运行时为范围；每课代码独立，并标出对应引擎源码位置。

## 运行

进入要学习的课程目录，按该课 README 中的命令运行。浏览器课有自己的 `deno.json`、`index.html` 和 `src/`；第 0 课是独立的元数据分析脚本。

课程讲义会列出对应的 Creator 源码路径，路径相对于仓库根目录。
