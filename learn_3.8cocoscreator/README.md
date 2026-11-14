# Creator 3.8.7 源码学习

以 Creator 3.8.7 的 Web 浏览器运行时为目标，用 TypeScript 逐课实现一份精简引擎。课程代码按源码职责组织，只保留当前主题需要的部分。

## 学习方式

1. 按编号阅读本课问题和源码位置。
2. 在本课目录运行独立代码。
3. 观察页面结果，再对照引擎源码。

每课都有自己的完整代码快照，不依赖其他课程。源码路径相对于仓库根目录；简化和省略内容在课内说明。

## 课程

- [课程大纲](课程大纲.md)
- [运行准备：浏览器宿主](web_host/README.md)
- [第 0 课：`.meta` 元数据分析](s00_meta_analysis/README.md)
- [第 1 课：模块导出](s01_module_assembly/README.md)
- [第 2 课：分阶段启动](s02_game_startup/README.md)
- [第 3 课：Director 与帧调度](s03_director_loop/README.md)
- [第 4 课：节点与场景树](s04_node_scene_tree/README.md)
- [第 5 课：本地位置与世界位置](s05_local_world_transform/README.md)
- [第 6 课：场景激活与节点状态](s06_node_activation/README.md)
- [第 7 课：组件挂载与生命周期](s07_component_lifecycle/README.md)
- [第 8 课：组件每帧调度](s08_component_scheduling/README.md)
- [第 9 课：资源请求与缓存](s09_asset_loading_cache/README.md)
- [第 10 课：Director 到渲染入口](s10_render_entry/README.md)
- [第 11 课：变换脏标记与子树失效](s11_transform_dirty/README.md)
- [第 12 课：四边形几何与 WebGL 提交](s12_sprite_quad/README.md)
- [第 13 课：SpriteFrame 连接贴图](s13_sprite_frame_texture/README.md)
- [第 14 课：浏览器输入坐标](s14_browser_input/README.md)
- [第 15 课：节点命中与事件回调](s15_node_event_hit/README.md)
- [第 16 课：节点事件传播](s16_event_propagation/README.md)
- [第 17 课：Prefab 实例化](s17_prefab_instantiation/README.md)
- [第 18 课：组件实例与资源共享](s18_component_asset_sharing/README.md)
- [第 19 课：实例挂载与组件生命周期](s19_instance_lifecycle/README.md)
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
- [第 40 课：AudioClip 到 PAL AudioPlayer](s40_audio_resource_entry/README.md)
- [第 41 课：AudioSource 播放生命周期](s41_audio_playback_lifecycle/README.md)
- [第 42 课：音量、循环与并发](s42_audio_concurrency_control/README.md)
- [第 43 课：PhysicsSystem2D 帧步进](s43_physics_world/README.md)
- [第 44 课：RigidBody2D 与 Collider2D 接线](s44_rigidbody_collider/README.md)
- [第 45 课：碰撞分组、接触回调与响应](s45_contact_filter/README.md)
- [第 46 课：物理查询与调试绘制](s46_physics_queries/README.md)
- [第 47 课：粒子系统创建与配置](s47_particle_system/README.md)
- [第 48 课：粒子发射与逐帧模拟](s48_particle_simulation/README.md)
- [第 49 课：粒子绘制与结束](s49_particle_render_finish/README.md)
- [第 50 课：目标选择与构建入口](s50_build_target_entry/README.md)
- [第 51 课：代码与引擎构建](s51_code_engine_build/README.md)
- [第 52 课：资源处理与产物结构](s52_resource_artifacts/README.md)
- [第 53 课：启动与交付](s53_startup_delivery/README.md)
- [第 54 课：Web 缓存与版本更新](s54_web_cache_versioning/README.md)：静态映射 URL 版本规则与部署层切换。
- [第 55 课：3D 物理世界与帧步进](s55_physics3d_world_step/README.md)：静态映射 PhysicsSystem 的固定子步。
- [第 56 课：CameraComponent 到 Root 渲染管线](s56_camera_root/README.md)：沿 3.8 的 RenderWindow、RenderScene 和 RenderPipeline 路径。
- [第 57 课：SceneCulling 与 RenderQueue](s57_scene_culling_queue/README.md)：按相机裁剪模型，再排序不透明/透明 Pass。
- [第 58 课：Sprite assembler 与 RenderData 刷新](s58_sprite_render_data/README.md)：追踪 UIRendererManager 与 Batcher2D 的职责。
- [第 59 课：MeshBuffer 更新 GFX Buffer](s59_mesh_buffer_upload/README.md)：沿 LinearBufferAccessor、GFX 与 WebGL Buffer 路径。
- [第 60 课：MaterialInstance 与 Pass 状态](s60_material_instance/README.md)：跟踪 Renderer 按需创建实例和覆盖状态。
- [第 61 课：ProgramLib 与 WebGL2 Shader](s61_shader_variant_programlib/README.md)：生成 GFX Shader 变体，并观察 GPU 程序的惰性创建。
- [第 62 课：Batcher2D 与 DrawBatch](s62_batcher2d_flush/README.md)：按 RenderData、材质和模板阶段结束当前批次。
- [第 63 课：MeshRenderer 创建 Model/SubModel](s63_mesh_model_submodels/README.md)：按子网格/材质槽建立模型对象并挂入 RenderScene。
- [第 64 课：Root 到 WebGL2 PrimaryCommandBuffer](s64_gfx_primary_command_buffer/README.md)：沿默认管线追踪 WebGL2 即时 draw 与 Queue 统计汇总。
- [第 65 课：RenderTexture 与 RenderWindow](s65_render_window_target/README.md)：由 Camera 切换 RenderWindow，再采样颜色附件。

## 第 66–80 课：物理、动画与 3D 粒子

- [第 66 课：Creator 3.8.7 刚体生命周期与节点同步](s66_rigidbody_sync/README.md)
- [第 67 课：Creator 3.8.7 碰撞体形状与物理材质](s67_collider_shapes/README.md)
- [第 68 课：Creator 3.8.7 接触事件与碰撞过滤](s68_contact_filter/README.md)
- [第 69 课：Creator 3.8.7 射线与物理查询](s69_physics_queries/README.md)
- [第 70 课：Creator 3.8.7 约束接口与后端能力边界](s70_constraint_boundary/README.md)
- [第 71 课：Creator 3.8.7 动画资源与片段](s71_animation_clip/README.md)
- [第 72 课：Creator 3.8.7 播放状态与时间推进](s72_animation_playback/README.md)
- [第 73 课：Creator 3.8.7 关键帧采样与属性写回](s73_animation_sampling/README.md)
- [第 74 课：Creator 3.8.7 动画事件与完成回调](s74_animation_events/README.md)
- [第 75 课：Creator 3.8.7 动画组合与过渡](s75_animation_transition/README.md)
- [第 76 课：Creator 3.8.7 粒子系统配置与发射器](s76_particle_emission/README.md)
- [第 77 课：Creator 3.8.7 粒子模拟与生命周期](s77_particle_simulation/README.md)
- [第 78 课：Creator 3.8.7 粒子属性模块与曲线](s78_particle_modules/README.md)
- [第 79 课：Creator 3.8.7 粒子渲染与批次](s79_particle_rendering/README.md)
- [第 80 课：Creator 3.8.7 停止发射与资源回收](s80_particle_lifecycle/README.md)

## 目录结构

~~~text
learn_3.8cocoscreator/
├── README.md
├── 课程大纲.md
├── web_host/               # 浏览器运行准备，不计课次
├── s00_meta_analysis/      # 分析编辑器 .meta 与子资源 UUID
├── s01_module_assembly/    # exports/base、模块重导出和兼容命名空间
├── s02_game_startup/       # Game.init 的阶段 Promise 链
├── s03_director_loop/      # Pacer、Game 更新回调和 Director.tick
├── s04_node_scene_tree/    # Node 父子关系和 Scene 树
├── s05_local_world_transform/ # 本地位置与世界位置
├── s06_node_activation/      # Scene 与节点的层级激活状态
├── s07_component_lifecycle/  # Component 挂载与节点激活回调
├── s08_component_scheduling/ # Component 每帧回调调度
├── s09_asset_loading_cache/  # AssetManager 请求和缓存 Asset
├── s10_render_entry/         # Director、Root 和 RenderPipeline 渲染入口
├── s11_transform_dirty/     # 变换脏标记和子树缓存失效
├── s12_sprite_quad/         # Sprite 几何数据和 Batcher2D 提交
├── s13_sprite_frame_texture/ # SpriteFrame 区域、UV 和贴图采样
├── s14_browser_input/        # 浏览器输入与画布坐标
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
├── s30_action_update_chain/ # Tween、ActionManager、TweenSystem 和 Director 更新链
├── s31_absolute_position_interpolation/ # 时间进度与绝对目标插值
├── s32_instant_and_delay_actions/   # 即时回调与延迟动作
├── s33_action_composition/          # 串行与并行动作
├── s34_action_modifiers/            # 缓动、重复与反向时间
├── s35_canvas_coordinates/          # Canvas 与屏幕坐标
├── s36_widget_alignment/            # Widget 对齐
├── s37_layout/                      # Layout 水平排布
├── s38_label_update/                # Label 文本更新
├── s39_button_interaction/          # Button 触摸与回调
├── s40_audio_resource_entry/  # 第 40 课：AudioClip 到 PAL AudioPlayer
├── s41_audio_playback_lifecycle/  # 第 41 课：AudioSource 播放生命周期
├── s42_audio_concurrency_control/  # 第 42 课：AudioSource 音量与 one-shot 并发
├── s43_physics_world/  # 第 43 课：PhysicsSystem2D 的帧步进
├── s44_rigidbody_collider/  # 第 44 课：RigidBody2D 与 Collider2D 怎样进入后端
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
├── s56_camera_root/  # 第 56 课：CameraComponent 到 Root 渲染管线
├── s57_scene_culling_queue/  # 第 57 课：SceneCulling 与 opaque/transparent RenderQueue
├── s58_sprite_render_data/  # 第 58 课：Sprite assembler 与 RenderData 刷新
├── s59_mesh_buffer_upload/  # 第 59 课：Creator 3.8 MeshBuffer 更新 GFX Buffer
├── s60_material_instance/  # 第 60 课：Creator 3.8 MaterialInstance 与 Pass 状态
├── s61_shader_variant_programlib/  # 第 61 课：Creator 3.8 ProgramLib 与 WebGL2 Shader
├── s62_batcher2d_flush/  # 第 62 课：Creator 3.8 Batcher2D 与 DrawBatch
├── s63_mesh_model_submodels/  # 第 63 课：Creator 3.8 MeshRenderer 创建 Model/SubModel
├── s64_gfx_primary_command_buffer/  # 第 64 课：Creator 3.8 Root 到 WebGL2 PrimaryCommandBuffer
├── s65_render_window_target/  # 第 65 课：Creator 3.8 RenderTexture 与 RenderWindow
├── s66_rigidbody_sync/  # 第 66 课：Creator 3.8.7 刚体生命周期与节点同步
├── s67_collider_shapes/  # 第 67 课：Creator 3.8.7 碰撞体形状与物理材质
├── s68_contact_filter/  # 第 68 课：Creator 3.8.7 接触事件与碰撞过滤
├── s69_physics_queries/  # 第 69 课：Creator 3.8.7 射线与物理查询
├── s70_constraint_boundary/  # 第 70 课：Creator 3.8.7 约束接口与后端能力边界
├── s71_animation_clip/  # 第 71 课：Creator 3.8.7 动画资源与片段
├── s72_animation_playback/  # 第 72 课：Creator 3.8.7 播放状态与时间推进
├── s73_animation_sampling/  # 第 73 课：Creator 3.8.7 关键帧采样与属性写回
├── s74_animation_events/  # 第 74 课：Creator 3.8.7 动画事件与完成回调
├── s75_animation_transition/  # 第 75 课：Creator 3.8.7 动画组合与过渡
├── s76_particle_emission/  # 第 76 课：Creator 3.8.7 粒子系统配置与发射器
├── s77_particle_simulation/  # 第 77 课：Creator 3.8.7 粒子模拟与生命周期
├── s78_particle_modules/  # 第 78 课：Creator 3.8.7 粒子属性模块与曲线
├── s79_particle_rendering/  # 第 79 课：Creator 3.8.7 粒子渲染与批次
├── s80_particle_lifecycle/  # 第 80 课：Creator 3.8.7 停止发射与资源回收
├── s81_spine_runtime_compatibility/  # 第 81 课：Creator 3.8.7 Runtime 与导出资源版本兼容
├── s82_spine_data_instance/  # 第 82 课：Creator 3.8.7 SkeletonData、Atlas 与实例所有权
├── s83_spine_animation_state/  # 第 83 课：Creator 3.8.7 AnimationState、轨道与混合
├── s84_spine_pose_update/  # 第 84 课：Creator 3.8.7 帧更新、骨骼层级与约束
├── s85_spine_slots_attachments/  # 第 85 课：Creator 3.8.7 Skin、Slot、Attachment 与绘制顺序
├── s86_spine_mesh_clipping/  # 第 86 课：Creator 3.8.7 网格附件、Deform 与 Clipping
├── s87_spine_render_submission/  # 第 87 课：Creator 3.8.7 引擎渲染接线与批次
├── s88_spine_events_lifecycle/  # 第 88 课：Creator 3.8.7 事件、调试观察与退出清理
├── s89_web_build_output_map/    # 第 89 课：Web 构建产物地图
├── s90_meta_asset_identity/     # 第 90 课：.meta 与资源身份
├── s91_asset_dependency_graph/  # 第 91 课：Asset 引用与依赖图
├── s92_asset_manager_pipeline/  # 第 92 课：AssetManager 加载管线
├── s93_bundle_config_urls/      # 第 93 课：Bundle 索引与文件 URL
├── s94_web_asset_request/       # 第 94 课：从场景到 Web 资源请求
├── s95_shader_stages/           # 第 95 课：Shader 源码与阶段
├── s96_vertex_inputs/           # 第 96 课：顶点输入与坐标变换
├── s97_texture_sampling/        # 第 97 课：插值、纹理采样与片元颜色
├── s98_shader_uniforms/         # 第 98 课：自定义 Uniform 与材质参数
├── s99_alpha_blending/           # 第 99 课：Alpha、预乘色与混合
├── s100_shader_variants/         # 第 100 课：宏变体与平台边界
└── s101_sprite_effect_debug/     # 第 101 课：Sprite 接入与调试
~~~

浏览器运行课进入各自目录，按 README 运行 `deno task check`、`deno task build` 和 `deno task serve`。第 0 课的元数据分析使用 `deno task check` 和 `deno task analyze`。

## Spine 2D 骨骼动画（第 81–88 课）

- [第 81 课：Creator 3.8.7 Runtime 与导出资源版本兼容](s81_spine_runtime_compatibility/README.md)
- [第 82 课：Creator 3.8.7 SkeletonData、Atlas 与实例所有权](s82_spine_data_instance/README.md)
- [第 83 课：Creator 3.8.7 AnimationState、轨道与混合](s83_spine_animation_state/README.md)
- [第 84 课：Creator 3.8.7 帧更新、骨骼层级与约束](s84_spine_pose_update/README.md)
- [第 85 课：Creator 3.8.7 Skin、Slot、Attachment 与绘制顺序](s85_spine_slots_attachments/README.md)
- [第 86 课：Creator 3.8.7 网格附件、Deform 与 Clipping](s86_spine_mesh_clipping/README.md)
- [第 87 课：Creator 3.8.7 引擎渲染接线与批次](s87_spine_render_submission/README.md)
- [第 88 课：Creator 3.8.7 事件、调试观察与退出清理](s88_spine_events_lifecycle/README.md)

## Web 资源导入与打包（第 89–94 课）

这 6 课一直追同一个实际例子：启动场景怎样找到 soldier Prefab，再找到它使用的 Mesh 文件。先把四种东西分开：

~~~text
工程源文件                      构建输出                       浏览器运行时
main.scene ───────┐            config：UUID → 文件索引       URL 请求文件
soldier.prefab ───┼─构建→      import：序列化资源数据   →   解析成 Asset 对象
soldier.FBX.meta ─┘            native：Mesh 数据               场景使用 Asset
~~~

| 名称 | 这里指什么 | 本例中的东西 |
| --- | --- | --- |
| `.meta` | 编辑器给工程资源保存的导入信息；不是浏览器请求的文件 | FBX 主 UUID、Mesh 子 UUID `@18751` |
| UUID | 资源的身份编号 | Prefab UUID、Mesh UUID |
| config | 构建生成的索引表；告诉运行时 UUID 对应哪个 pack 或文件 | `assets/main/config.json` |
| URL | 浏览器实际请求的文件地址 | 场景 pack 地址、Mesh `.bin` 地址 |
| Asset | 文件解析后在内存中供引擎使用的对象 | `SceneAsset`、`Prefab`、`Mesh` |

阅读顺序是：89 先认输出文件；90 找 UUID 的来历；91 从场景和 Prefab 引用画出依赖；92 看下载和创建 Asset 的职责；93 手动算出文件地址；94 把它们串起来，并在 Network 面板观察真实请求。每课的“课程代码”只演示本课负责的一步，真实字段来源和简化范围都写在课文里。

本版实际关系是：**`main.scene` 引用 soldier Prefab；Prefab 的 MeshRenderer 引用 FBX 导入出的 Mesh 子资源 `@18751`；构建把序列化数据放进 import pack，把 Mesh 数据放进 native 文件。** 请先在 `3.8NewProject/assets/` 找源文件，再看 `3.8NewProject/build/web-mobile/` 的构建结果。样例由 Creator 3.8.8 构建，本地 Runtime 源码快照为 3.8.7；课程模型日志不是 Creator 运行日志。

- 第 89 课回答“构建目录里有哪些文件”。
- 第 90 课回答“Prefab 怎样找到 FBX 导入出的 Mesh UUID”。
- 第 91 课回答“加载场景还需要哪些 Asset”。
- 第 92 课回答“文件怎样变成并缓存为 Asset 对象”。
- 第 93 课回答“Bundle Config 怎样把 UUID 变成 URL”。
- 第 94 课把前面几步连起来，并教你在浏览器 Network 面板观察真实请求。

- [第 89 课：Web 构建产物地图](s89_web_build_output_map/README.md)
- [第 90 课：`.meta` 与资源身份](s90_meta_asset_identity/README.md)
- [第 91 课：Asset 引用与依赖图](s91_asset_dependency_graph/README.md)
- [第 92 课：AssetManager 加载管线](s92_asset_manager_pipeline/README.md)
- [第 93 课：Bundle 索引与文件 URL](s93_bundle_config_urls/README.md)
- [第 94 课：从场景到 Web 资源请求](s94_web_asset_request/README.md)

Creator 课程以 Web 浏览器运行时为范围；每课代码独立，并标出对应引擎源码位置。编辑器导入器和完整 Builder 不在本地 Runtime 快照中，因此课程会明确标出“工程文件事实”“构建输出事实”和“Runtime 源码行为”，不把它们混成一个步骤。

## Shader 编写与接入（第 95–101 课，已完成）

本专题按 Creator 3.8.7 的源码路径独立实现。七课从两段 Shader 开始，逐步加入顶点输入、纹理、Uniform、Alpha、宏变体，最后追到 Sprite 绘制。

本系列以 WebGL 2 为运行目标；每课是独立 TypeScript/浏览器示例，画布运行真实 WebGL2 Shader。

- [第 95 课：Shader 源码与阶段](s95_shader_stages/README.md)
- [第 96 课：顶点输入与坐标变换](s96_vertex_inputs/README.md)
- [第 97 课：插值、纹理采样与片元颜色](s97_texture_sampling/README.md)
- [第 98 课：自定义 Uniform 与材质参数](s98_shader_uniforms/README.md)
- [第 99 课：Alpha、预乘色与混合](s99_alpha_blending/README.md)
- [第 100 课：宏变体与平台边界](s100_shader_variants/README.md)
- [第 101 课：Sprite 接入与调试](s101_sprite_effect_debug/README.md)
