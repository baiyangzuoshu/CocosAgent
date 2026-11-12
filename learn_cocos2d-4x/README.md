# Cocos2d-x 4.0 源码学习

以仓库中的 `engine/cocos2d-x-4/` 为源码依据，用 C++ 按主题裁出最小课程实现。每课保留对应的源码职责，只去掉当前主题无关的引擎部分，并提供独立代码和准确源码位置。

同系列历史版本课程：[Cocos2d-x 1.x](../learn_cocos2d-1x/README.md)、[2.x](../learn_cocos2d-2x/README.md)、[3.x](../learn_cocos2d-3x/README.md)。

- [课程大纲](课程大纲.md)

## 同主题课程

| 主题 | Cocos2d-x 4.0 | Creator 2.4.15 | Creator 3.8.7 |
| --- | --- | --- | --- |
| 第 4 课：节点与场景树 | [本课](s04_node_scene_tree/README.md) | [本课](../learn_2.4cocoscreator/s04_node_scene_tree/README.md) | [本课](../learn_3.8cocoscreator/s04_node_scene_tree/README.md) |
| 第 5 课：本地位置与世界位置 | [本课](s05_local_world_transform/README.md) | [本课](../learn_2.4cocoscreator/s05_local_world_transform/README.md) | [本课](../learn_3.8cocoscreator/s05_local_world_transform/README.md) |
| 第 7 课：组件挂载与生命周期 | [本课](s07_component_lifecycle/README.md) | [本课](../learn_2.4cocoscreator/s07_component_lifecycle/README.md) | [本课](../learn_3.8cocoscreator/s07_component_lifecycle/README.md) |
| 第 8 课：组件更新调度 | [本课](s08_scheduler_component_update/README.md) | [本课](../learn_2.4cocoscreator/s08_component_scheduling/README.md) | [本课](../learn_3.8cocoscreator/s08_component_scheduling/README.md) |
| 第 9 课：资源请求与纹理缓存 | [本课](s09_texture_cache/README.md) | [本课](../learn_2.4cocoscreator/s09_asset_loading_cache/README.md) | [本课](../learn_3.8cocoscreator/s09_asset_loading_cache/README.md) |
| 第 10 课：场景遍历与渲染命令提交 | [本课](s10_render_entry/README.md) | [本课](../learn_2.4cocoscreator/s10_render_entry/README.md) | [本课](../learn_3.8cocoscreator/s10_render_entry/README.md) |
| 第 11 课：GlobalZOrder 与命令排序 | [本课](s11_global_z_order/README.md) | — | — |
| 第 12 课：Sprite 几何数据提交 | [本课](s12_sprite_triangles/README.md) | [本课](../learn_2.4cocoscreator/s12_sprite_quad/README.md) | [本课](../learn_3.8cocoscreator/s12_sprite_quad/README.md) |
| 第 13 课：SpriteFrame 与贴图区域 | [本课](s13_sprite_frame_texture/README.md) | [本课](../learn_2.4cocoscreator/s13_sprite_frame_texture/README.md) | [本课](../learn_3.8cocoscreator/s13_sprite_frame_texture/README.md) |
| 第 14 课：输入与触摸坐标 | [本课](s14_touch_input/README.md) | [本课](../learn_2.4cocoscreator/s14_browser_input/README.md) | [本课](../learn_3.8cocoscreator/s14_browser_input/README.md) |
| 第 15 课：触摸监听与命中 | [本课](s15_touch_listener/README.md) | [本课](../learn_2.4cocoscreator/s15_node_event_hit/README.md) | [本课](../learn_3.8cocoscreator/s15_node_event_hit/README.md) |
| 第 16 课：事件传播与触摸吞噬 | [本课](s16_touch_swallow/README.md) | [本课](../learn_2.4cocoscreator/s16_event_propagation/README.md) | [本课](../learn_3.8cocoscreator/s16_event_propagation/README.md) |
| 第 17 课：可复用场景内容 | [本课](s17_node_factory/README.md) | [Prefab 实例化](../learn_2.4cocoscreator/s17_prefab_instantiation/README.md) | [Prefab 实例化](../learn_3.8cocoscreator/s17_prefab_instantiation/README.md) |
| 第 18 课：实例数据与资源共享 | [本课](s18_sprite_resource_sharing/README.md) | [本课](../learn_2.4cocoscreator/s18_component_asset_sharing/README.md) | [本课](../learn_3.8cocoscreator/s18_component_asset_sharing/README.md) |
| 第 19 课：场景挂载与组件生命周期 | [本课](s19_instance_lifecycle/README.md) | [本课](../learn_2.4cocoscreator/s19_instance_lifecycle/README.md) | [本课](../learn_3.8cocoscreator/s19_instance_lifecycle/README.md) |
| 第 20 课：节点退出与重新挂载 | [本课](s20_node_detachment/README.md) | [本课](../learn_2.4cocoscreator/s20_node_detachment/README.md) | [本课](../learn_3.8cocoscreator/s20_node_detachment/README.md) |
| 第 21 课：cleanup 与引用释放 | [本课](s21_cleanup_and_release/README.md) | [本课](../learn_2.4cocoscreator/s21_deferred_destruction/README.md) | [本课](../learn_3.8cocoscreator/s21_deferred_destruction/README.md) |
| 第 22 课：节点池复用 | [本课](s22_node_pool/README.md) | [本课](../learn_2.4cocoscreator/s22_node_pool/README.md) | [本课](../learn_3.8cocoscreator/s22_node_pool/README.md) |
| 第 23 课：对象池复用与未命中兜底 | [本课](s23_pool_reuse_flow/README.md) | [本课](../learn_2.4cocoscreator/s23_pool_reuse_flow/README.md) | [本课](../learn_3.8cocoscreator/s23_pool_reuse_flow/README.md) |
| 第 24 课：对象池容量与预热补充 | [本课](s24_pool_capacity_strategy/README.md) | [本课](../learn_2.4cocoscreator/s24_pool_capacity_strategy/README.md) | [本课](../learn_3.8cocoscreator/s24_pool_capacity_strategy/README.md) |
| 第 25 课：清池与节点存活 | [本课](s25_pool_clear_lifetime/README.md) | [本课](../learn_2.4cocoscreator/s25_pool_clear_lifetime/README.md) | [本课](../learn_3.8cocoscreator/s25_pool_clear_lifetime/README.md) |
| 第 26 课：对象池中的节点运行状态 | [本课](s26_pool_runtime_lifecycle/README.md) | [本课](../learn_2.4cocoscreator/s26_pool_runtime_lifecycle/README.md) | [本课](../learn_3.8cocoscreator/s26_pool_runtime_lifecycle/README.md) |
| 第 27 课：取出顺序与重复入池保护 | [本课](s27_pool_order_and_duplicates/README.md) | [本课](../learn_2.4cocoscreator/s27_pool_order_and_duplicates/README.md) | [本课](../learn_3.8cocoscreator/s27_pool_order_and_duplicates/README.md) |
| 第 28 课：节点池所有权与接收结果 | [本课](s28_pool_ownership/README.md) | [本课](../learn_2.4cocoscreator/s28_pool_ownership/README.md) | [本课](../learn_3.8cocoscreator/s28_pool_ownership/README.md) |
| 第 29 课：对象池关闭与终态 | [本课](s29_pool_disposal/README.md) | [本课](../learn_2.4cocoscreator/s29_pool_disposal/README.md) | [本课](../learn_3.8cocoscreator/s29_pool_disposal/README.md) |
| 第 30 课：动作更新链（复用第 6 课代码） | [第 6 课代码](s06_action_scheduler/README.md) | [本课](../learn_2.4cocoscreator/s30_action_update_chain/README.md) | [本课](../learn_3.8cocoscreator/s30_action_update_chain/README.md) |
| 第 31 课：时间进度与绝对目标插值 | [本课](s31_absolute_position_interpolation/README.md) | [本课](../learn_2.4cocoscreator/s31_absolute_position_interpolation/README.md) | [本课](../learn_3.8cocoscreator/s31_absolute_position_interpolation/README.md) |
| 第 32 课：即时回调与延迟动作 | [本课](s32_instant_and_delay_actions/README.md) | [本课](../learn_2.4cocoscreator/s32_instant_and_delay_actions/README.md) | [本课](../learn_3.8cocoscreator/s32_instant_and_delay_actions/README.md) |
| 第 33 课：串行与并行动作 | [本课](s33_action_composition/README.md) | [本课](../learn_2.4cocoscreator/s33_action_composition/README.md) | [本课](../learn_3.8cocoscreator/s33_action_composition/README.md) |
| 第 34 课：缓动、重复与反向时间 | [本课](s34_action_modifiers/README.md) | [本课](../learn_2.4cocoscreator/s34_action_modifiers/README.md) | [本课](../learn_3.8cocoscreator/s34_action_modifiers/README.md) |
| 第 35 课：Canvas 与屏幕坐标 | [本课](s35_canvas_coordinates/README.md) | [本课](../learn_2.4cocoscreator/s35_canvas_coordinates/README.md) | [本课](../learn_3.8cocoscreator/s35_canvas_coordinates/README.md) |
| 第 36 课：Widget 对齐 | [本课](s36_widget_alignment/README.md) | [本课](../learn_2.4cocoscreator/s36_widget_alignment/README.md) | [本课](../learn_3.8cocoscreator/s36_widget_alignment/README.md) |
| 第 37 课：Layout 水平排布 | [本课](s37_layout/README.md) | [本课](../learn_2.4cocoscreator/s37_layout/README.md) | [本课](../learn_3.8cocoscreator/s37_layout/README.md) |
| 第 38 课：Label 文本更新 | [本课](s38_label_update/README.md) | [本课](../learn_2.4cocoscreator/s38_label_update/README.md) | [本课](../learn_3.8cocoscreator/s38_label_update/README.md) |
| 第 39 课：Button 交互 | [本课](s39_button_interaction/README.md) | [本课](../learn_2.4cocoscreator/s39_button_interaction/README.md) | [本课](../learn_3.8cocoscreator/s39_button_interaction/README.md) |
| 第 40 课：音频资源与引擎入口 | [本课](s40_audio_resource_entry/README.md) | [本课](../learn_2.4cocoscreator/s40_audio_resource_entry/README.md) | [本课](../learn_3.8cocoscreator/s40_audio_resource_entry/README.md) |
| 第 41 课：音频播放生命周期 | [本课](s41_audio_playback_lifecycle/README.md) | [本课](../learn_2.4cocoscreator/s41_audio_playback_lifecycle/README.md) | [本课](../learn_3.8cocoscreator/s41_audio_playback_lifecycle/README.md) |
| 第 42 课：并发、音量与资源释放 | [本课](s42_audio_concurrency_control/README.md) | [本课](../learn_2.4cocoscreator/s42_audio_concurrency_control/README.md) | [本课](../learn_3.8cocoscreator/s42_audio_concurrency_control/README.md) |
| 第 43 课：物理世界与帧步进 | [本课](s43_physics_world/README.md) | [本课](../learn_2.4cocoscreator/s43_physics_world/README.md) | [本课](../learn_3.8cocoscreator/s43_physics_world/README.md) |
| 第 44 课：刚体与碰撞形状接线 | [本课](s44_rigidbody_collider/README.md) | [本课](../learn_2.4cocoscreator/s44_rigidbody_collider/README.md) | [本课](../learn_3.8cocoscreator/s44_rigidbody_collider/README.md) |
| 第 45 课：碰撞过滤、接触通知与响应 | [本课](s45_contact_filter/README.md) | [本课](../learn_2.4cocoscreator/s45_contact_filter/README.md) | [本课](../learn_3.8cocoscreator/s45_contact_filter/README.md) |
| 第 46 课：物理查询与调试绘制 | [本课](s46_physics_queries/README.md) | [本课](../learn_2.4cocoscreator/s46_physics_queries/README.md) | [本课](../learn_3.8cocoscreator/s46_physics_queries/README.md) |
| 第 47 课：粒子系统创建与配置 | [本课](s47_particle_system/README.md) | [本课](../learn_2.4cocoscreator/s47_particle_system/README.md) | [本课](../learn_3.8cocoscreator/s47_particle_system/README.md) |
| 第 48 课：粒子发射与逐帧模拟 | [本课](s48_particle_simulation/README.md) | [本课](../learn_2.4cocoscreator/s48_particle_simulation/README.md) | [本课](../learn_3.8cocoscreator/s48_particle_simulation/README.md) |
| 第 49 课：粒子绘制与结束 | [本课](s49_particle_render_finish/README.md) | [本课](../learn_2.4cocoscreator/s49_particle_render_finish/README.md) | [本课](../learn_3.8cocoscreator/s49_particle_render_finish/README.md) |
| 第 50 课：目标选择与构建入口 | [本课](s50_build_target_entry/README.md) | [本课](../learn_2.4cocoscreator/s50_build_target_entry/README.md) | [本课](../learn_3.8cocoscreator/s50_build_target_entry/README.md) |
| 第 51 课：代码与引擎构建 | [本课](s51_code_engine_build/README.md) | [本课](../learn_2.4cocoscreator/s51_code_engine_build/README.md) | [本课](../learn_3.8cocoscreator/s51_code_engine_build/README.md) |
| 第 52 课：资源处理与产物结构 | [本课](s52_resource_artifacts/README.md) | [本课](../learn_2.4cocoscreator/s52_resource_artifacts/README.md) | [本课](../learn_3.8cocoscreator/s52_resource_artifacts/README.md) |
| 第 53 课：启动与交付 | [本课](s53_startup_delivery/README.md) | [本课](../learn_2.4cocoscreator/s53_startup_delivery/README.md) | [本课](../learn_3.8cocoscreator/s53_startup_delivery/README.md) |
| 第 56 课：Camera 与视口路径 | [本课](s56_camera_viewport/README.md) | [本课](../learn_2.4cocoscreator/s56_camera_view/README.md) | [本课](../learn_3.8cocoscreator/s56_camera_root/README.md) |
| 第 57 课：相机裁剪与绘制顺序 | [本课](s57_node_render_order/README.md) | [本课](../learn_2.4cocoscreator/s57_camera_culling_queue/README.md) | [本课](../learn_3.8cocoscreator/s57_scene_culling_queue/README.md) |
| 第 58 课：Sprite 几何数据更新 | [本课](s58_sprite_quad_update/README.md) | [本课](../learn_2.4cocoscreator/s58_sprite_render_data/README.md) | [本课](../learn_3.8cocoscreator/s58_sprite_render_data/README.md) |
| 第 59 课：顶点/索引数据上传 | [本课](s59_backend_buffer_update/README.md) | [本课](../learn_2.4cocoscreator/s59_mesh_buffer_upload/README.md) | [本课](../learn_3.8cocoscreator/s59_mesh_buffer_upload/README.md) |

历史 Cocos2d-x 同主题：[1.x](../learn_cocos2d-1x/s09_texture_cache/README.md)、[2.x](../learn_cocos2d-2x/s09_texture_cache/README.md)、[3.x](../learn_cocos2d-3x/s09_texture_cache/README.md)。

历史 Cocos2d-x 第 10 课：[1.x](../learn_cocos2d-1x/s10_render_entry/README.md)、[2.x](../learn_cocos2d-2x/s10_render_entry/README.md)、[3.x](../learn_cocos2d-3x/s10_render_entry/README.md)。

历史 Cocos2d-x 第 11 课：[1.x](../learn_cocos2d-1x/s11_node_visibility/README.md)、[2.x](../learn_cocos2d-2x/s11_node_visibility/README.md)、[3.x](../learn_cocos2d-3x/s11_global_z_order/README.md)。

历史 Cocos2d-x 第 12 课：[1.x](../learn_cocos2d-1x/s12_sprite_quad/README.md)、[2.x](../learn_cocos2d-2x/s12_sprite_quad/README.md)、[3.x](../learn_cocos2d-3x/s12_sprite_triangles/README.md)。

历史 Cocos2d-x 第 13 课：[1.x](../learn_cocos2d-1x/s13_sprite_frame/README.md)、[2.x](../learn_cocos2d-2x/s13_sprite_frame/README.md)、[3.x](../learn_cocos2d-3x/s13_sprite_frame_texture/README.md)。

历史 Cocos2d-x 第 56 课：[1.x](../learn_cocos2d-1x/s56_camera_viewport/README.md)、[2.x](../learn_cocos2d-2x/s56_camera_viewport/README.md)、[3.x](../learn_cocos2d-3x/s56_camera_viewport/README.md)。

历史 Cocos2d-x 第 57 课：[1.x](../learn_cocos2d-1x/s57_node_draw_order/README.md)、[2.x](../learn_cocos2d-2x/s57_node_draw_order/README.md)、[3.x](../learn_cocos2d-3x/s57_node_render_order/README.md)。

历史 Cocos2d-x 第 58 课：[1.x](../learn_cocos2d-1x/s58_sprite_quad_update/README.md)、[2.x](../learn_cocos2d-2x/s58_sprite_quad_update/README.md)、[3.x](../learn_cocos2d-3x/s58_sprite_quad_update/README.md)。

历史 Cocos2d-x 第 59 课：[1.x](../learn_cocos2d-1x/s59_atlas_vbo_upload/README.md)、[2.x](../learn_cocos2d-2x/s59_atlas_vbo_upload/README.md)、[3.x](../learn_cocos2d-3x/s59_renderer_vertex_upload/README.md)。

各课程独立阅读和运行；表格用于快速打开同主题内容。

本课程第 60 课：[StateBlock 合并到 backend 管线描述](s60_backend_pipeline_state/README.md)。

本课程第 61 课：[backend Program 与 Uniform 数据](s61_backend_program_state/README.md)。

本课程第 62 课：[QuadCommand 合批与 material ID](s62_triangle_command_batching/README.md)。

本课程第 63 课：[Sprite3D 与多 Pass MeshCommand](s63_sprite3d_pass_commands/README.md)。

本课程第 64 课：[Renderer 到 backend CommandBuffer](s64_backend_command_buffer/README.md)。

本课程第 65 课：[RenderTexture backend 目标](s65_backend_render_target/README.md)。

历史 Cocos2d-x 第 14 课：[1.x](../learn_cocos2d-1x/s14_touch_input/README.md)、[2.x](../learn_cocos2d-2x/s14_touch_input/README.md)、[3.x](../learn_cocos2d-3x/s14_touch_input/README.md)。

历史 Cocos2d-x 第 15 课：[1.x](../learn_cocos2d-1x/s15_touch_listener/README.md)、[2.x](../learn_cocos2d-2x/s15_touch_listener/README.md)、[3.x](../learn_cocos2d-3x/s15_touch_listener/README.md)。

历史 Cocos2d-x 第 16 课：[1.x](../learn_cocos2d-1x/s16_touch_swallow/README.md)、[2.x](../learn_cocos2d-2x/s16_touch_swallow/README.md)、[3.x](../learn_cocos2d-3x/s16_touch_swallow/README.md)。

历史 Cocos2d-x 第 17 课：[1.x](../learn_cocos2d-1x/s17_node_factory/README.md)、[2.x](../learn_cocos2d-2x/s17_node_factory/README.md)、[3.x](../learn_cocos2d-3x/s17_node_factory/README.md)。Cocos2d-x 用节点树构造器复用结构，Creator 使用 Prefab 资源实例化。

历史 Cocos2d-x 第 18 课：[1.x](../learn_cocos2d-1x/s18_sprite_resource_sharing/README.md)、[2.x](../learn_cocos2d-2x/s18_sprite_resource_sharing/README.md)、[3.x](../learn_cocos2d-3x/s18_sprite_resource_sharing/README.md)。1.x/2.x 显示 Sprite 共享纹理；3.x/4.x 显示 SpriteFrame 引用共享。

历史 Cocos2d-x 第 19 课：[1.x](../learn_cocos2d-1x/s19_instance_lifecycle/README.md)、[2.x](../learn_cocos2d-2x/s19_instance_lifecycle/README.md)、[3.x](../learn_cocos2d-3x/s19_instance_lifecycle/README.md)。各代回调时机不同，详见课内源码位置。

历史 Cocos2d-x 第 20 课：[1.x](../learn_cocos2d-1x/s20_node_detachment/README.md)、[2.x](../learn_cocos2d-2x/s20_node_detachment/README.md)、[3.x](../learn_cocos2d-3x/s20_node_detachment/README.md)。

历史 Cocos2d-x 第 21 课：[1.x](../learn_cocos2d-1x/s21_cleanup_and_release/README.md)、[2.x](../learn_cocos2d-2x/s21_cleanup_and_release/README.md)、[3.x](../learn_cocos2d-3x/s21_cleanup_and_release/README.md)。

历史 Cocos2d-x 第 22 课：[1.x](../learn_cocos2d-1x/s22_node_pool/README.md)、[2.x](../learn_cocos2d-2x/s22_node_pool/README.md)、[3.x](../learn_cocos2d-3x/s22_node_pool/README.md)。

历史 Cocos2d-x 第 23 课：[1.x](../learn_cocos2d-1x/s23_pool_reuse_flow/README.md)、[2.x](../learn_cocos2d-2x/s23_pool_reuse_flow/README.md)、[3.x](../learn_cocos2d-3x/s23_pool_reuse_flow/README.md)。

历史 Cocos2d-x 第 24 课：[1.x](../learn_cocos2d-1x/s24_pool_capacity_strategy/README.md)、[2.x](../learn_cocos2d-2x/s24_pool_capacity_strategy/README.md)、[3.x](../learn_cocos2d-3x/s24_pool_capacity_strategy/README.md)。

历史 Cocos2d-x 第 25 课：[1.x](../learn_cocos2d-1x/s25_pool_clear_lifetime/README.md)、[2.x](../learn_cocos2d-2x/s25_pool_clear_lifetime/README.md)、[3.x](../learn_cocos2d-3x/s25_pool_clear_lifetime/README.md)。

历史 Cocos2d-x 第 26 课：[1.x](../learn_cocos2d-1x/s26_pool_runtime_lifecycle/README.md)、[2.x](../learn_cocos2d-2x/s26_pool_runtime_lifecycle/README.md)、[3.x](../learn_cocos2d-3x/s26_pool_runtime_lifecycle/README.md)。

历史 Cocos2d-x 第 27 课：[1.x](../learn_cocos2d-1x/s27_pool_order_and_duplicates/README.md)、[2.x](../learn_cocos2d-2x/s27_pool_order_and_duplicates/README.md)、[3.x](../learn_cocos2d-3x/s27_pool_order_and_duplicates/README.md)。

历史 Cocos2d-x 第 28 课：[1.x](../learn_cocos2d-1x/s28_pool_ownership/README.md)、[2.x](../learn_cocos2d-2x/s28_pool_ownership/README.md)、[3.x](../learn_cocos2d-3x/s28_pool_ownership/README.md)。

历史 Cocos2d-x 第 29 课：[1.x](../learn_cocos2d-1x/s29_pool_disposal/README.md)、[2.x](../learn_cocos2d-2x/s29_pool_disposal/README.md)、[3.x](../learn_cocos2d-3x/s29_pool_disposal/README.md)。

历史 Cocos2d-x 第 30 课复用第 6 课独立代码：[1.x](../learn_cocos2d-1x/s06_action_scheduler/README.md)、[2.x](../learn_cocos2d-2x/s06_action_scheduler/README.md)、[3.x](../learn_cocos2d-3x/s06_action_scheduler/README.md)。

历史 Cocos2d-x 第 31 课：[1.x](../learn_cocos2d-1x/s31_absolute_position_interpolation/README.md)、[2.x](../learn_cocos2d-2x/s31_absolute_position_interpolation/README.md)、[3.x](../learn_cocos2d-3x/s31_absolute_position_interpolation/README.md)。

历史 Cocos2d-x 第 32 课：[1.x](../learn_cocos2d-1x/s32_instant_and_delay_actions/README.md)、[2.x](../learn_cocos2d-2x/s32_instant_and_delay_actions/README.md)、[3.x](../learn_cocos2d-3x/s32_instant_and_delay_actions/README.md)。1.x 在 `startWithTarget` 同步调用回调，2.x–4.x 在动作更新中调用。

历史 Cocos2d-x 第 33 课：[1.x](../learn_cocos2d-1x/s33_action_composition/README.md)、[2.x](../learn_cocos2d-2x/s33_action_composition/README.md)、[3.x](../learn_cocos2d-3x/s33_action_composition/README.md)。

历史 Cocos2d-x 第 34 课：[1.x](../learn_cocos2d-1x/s34_action_modifiers/README.md)、[2.x](../learn_cocos2d-2x/s34_action_modifiers/README.md)、[3.x](../learn_cocos2d-3x/s34_action_modifiers/README.md)。

历史 Cocos2d-x 第 35 课：[1.x](../learn_cocos2d-1x/s35_canvas_coordinates/README.md)、[2.x](../learn_cocos2d-2x/s35_canvas_coordinates/README.md)、[3.x](../learn_cocos2d-3x/s35_canvas_coordinates/README.md)。

历史 Cocos2d-x 第 36 课：[1.x](../learn_cocos2d-1x/s36_widget_alignment/README.md)、[2.x](../learn_cocos2d-2x/s36_widget_alignment/README.md)、[3.x](../learn_cocos2d-3x/s36_widget_alignment/README.md)。

历史 Cocos2d-x 第 37 课：[1.x](../learn_cocos2d-1x/s37_layout/README.md)、[2.x](../learn_cocos2d-2x/s37_layout/README.md)、[3.x](../learn_cocos2d-3x/s37_layout/README.md)。

历史 Cocos2d-x 第 38 课：[1.x](../learn_cocos2d-1x/s38_label_update/README.md)、[2.x](../learn_cocos2d-2x/s38_label_update/README.md)、[3.x](../learn_cocos2d-3x/s38_label_update/README.md)。

历史 Cocos2d-x 第 39 课：[1.x](../learn_cocos2d-1x/s39_button_interaction/README.md)、[2.x](../learn_cocos2d-2x/s39_button_interaction/README.md)、[3.x](../learn_cocos2d-3x/s39_button_interaction/README.md)。

历史 Cocos2d-x 第 40 课：[1.x](../learn_cocos2d-1x/s40_audio_resource_entry/README.md)、[2.x](../learn_cocos2d-2x/s40_audio_resource_entry/README.md)、[3.x](../learn_cocos2d-3x/s40_audio_resource_entry/README.md)。

历史 Cocos2d-x 第 41 课：[1.x](../learn_cocos2d-1x/s41_audio_playback_lifecycle/README.md)、[2.x](../learn_cocos2d-2x/s41_audio_playback_lifecycle/README.md)、[3.x](../learn_cocos2d-3x/s41_audio_playback_lifecycle/README.md)。

历史 Cocos2d-x 第 42 课：[1.x](../learn_cocos2d-1x/s42_audio_concurrency_control/README.md)、[2.x](../learn_cocos2d-2x/s42_audio_concurrency_control/README.md)、[3.x](../learn_cocos2d-3x/s42_audio_concurrency_control/README.md)。

历史 Cocos2d-x 第 43 课：[1.x](../learn_cocos2d-1x/s43_physics_world/README.md)、[2.x](../learn_cocos2d-2x/s43_physics_world/README.md)、[3.x](../learn_cocos2d-3x/s43_physics_world/README.md)。

历史 Cocos2d-x 第 44 课：[1.x](../learn_cocos2d-1x/s44_rigidbody_collider/README.md)、[2.x](../learn_cocos2d-2x/s44_rigidbody_collider/README.md)、[3.x](../learn_cocos2d-3x/s44_rigidbody_collider/README.md)。

历史 Cocos2d-x 第 45 课：[1.x](../learn_cocos2d-1x/s45_contact_filter/README.md)、[2.x](../learn_cocos2d-2x/s45_contact_filter/README.md)、[3.x](../learn_cocos2d-3x/s45_contact_filter/README.md)。

历史 Cocos2d-x 第 46 课：[1.x](../learn_cocos2d-1x/s46_physics_queries/README.md)、[2.x](../learn_cocos2d-2x/s46_physics_queries/README.md)、[3.x](../learn_cocos2d-3x/s46_physics_queries/README.md)。

历史 Cocos2d-x 第 47 课：[1.x](../learn_cocos2d-1x/s47_particle_system/README.md)、[2.x](../learn_cocos2d-2x/s47_particle_system/README.md)、[3.x](../learn_cocos2d-3x/s47_particle_system/README.md)。

历史 Cocos2d-x 第 48 课：[1.x](../learn_cocos2d-1x/s48_particle_simulation/README.md)、[2.x](../learn_cocos2d-2x/s48_particle_simulation/README.md)、[3.x](../learn_cocos2d-3x/s48_particle_simulation/README.md)。

历史 Cocos2d-x 第 49 课：[1.x](../learn_cocos2d-1x/s49_particle_render_finish/README.md)、[2.x](../learn_cocos2d-2x/s49_particle_render_finish/README.md)、[3.x](../learn_cocos2d-3x/s49_particle_render_finish/README.md)。

历史 Cocos2d-x 第 50 课：[1.x](../learn_cocos2d-1x/s50_build_target_entry/README.md)、[2.x](../learn_cocos2d-2x/s50_build_target_entry/README.md)、[3.x](../learn_cocos2d-3x/s50_build_target_entry/README.md)。

历史 Cocos2d-x 第 51 课：[1.x](../learn_cocos2d-1x/s51_code_engine_build/README.md)、[2.x](../learn_cocos2d-2x/s51_code_engine_build/README.md)、[3.x](../learn_cocos2d-3x/s51_code_engine_build/README.md)。

历史 Cocos2d-x 第 52 课：[1.x](../learn_cocos2d-1x/s52_resource_artifacts/README.md)、[2.x](../learn_cocos2d-2x/s52_resource_artifacts/README.md)、[3.x](../learn_cocos2d-3x/s52_resource_artifacts/README.md)。

历史 Cocos2d-x 第 53 课：[1.x](../learn_cocos2d-1x/s53_startup_delivery/README.md)、[2.x](../learn_cocos2d-2x/s53_startup_delivery/README.md)、[3.x](../learn_cocos2d-3x/s53_startup_delivery/README.md)。
## 第 66–80 课：物理、动画与 3D 粒子

- [第 66 课：Cocos2d-x 4.0 刚体生命周期与节点同步](s66_rigidbody_sync/README.md)
- [第 67 课：Cocos2d-x 4.0 碰撞体形状与物理材质](s67_collider_shapes/README.md)
- [第 68 课：Cocos2d-x 4.0 接触事件与碰撞过滤](s68_contact_filter/README.md)
- [第 69 课：Cocos2d-x 4.0 射线与物理查询](s69_physics_queries/README.md)
- [第 70 课：Cocos2d-x 4.0 约束接口与后端能力边界](s70_constraint_boundary/README.md)
- [第 71 课：Cocos2d-x 4.0 动画资源与片段](s71_animation_clip/README.md)
- [第 72 课：Cocos2d-x 4.0 播放状态与时间推进](s72_animation_playback/README.md)
- [第 73 课：Cocos2d-x 4.0 关键帧采样与属性写回](s73_animation_sampling/README.md)
- [第 74 课：Cocos2d-x 4.0 动画事件与完成回调](s74_animation_events/README.md)
- [第 75 课：Cocos2d-x 4.0 动画组合与过渡](s75_animation_transition/README.md)
- [第 76 课：Cocos2d-x 4.0 粒子系统配置与发射器](s76_particle_emission/README.md)
- [第 77 课：Cocos2d-x 4.0 粒子模拟与生命周期](s77_particle_simulation/README.md)
- [第 78 课：Cocos2d-x 4.0 粒子属性模块与曲线](s78_particle_modules/README.md)
- [第 79 课：Cocos2d-x 4.0 粒子渲染与批次](s79_particle_rendering/README.md)
- [第 80 课：Cocos2d-x 4.0 停止发射与资源回收](s80_particle_lifecycle/README.md)
