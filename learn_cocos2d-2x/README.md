# Cocos2d-x 2.x 源码学习

本课程以仓库快照 `engine/cocos2d-x-2/`（版本 `2.2.6`）为依据，用 C++ 逐课裁出独立小程序。每课保留本代类名和源码目录，只删除当前主题无关的引擎部分。

版本标记取自 `engine/cocos2d-x-2/CHANGELOG:4`。

- [课程大纲](课程大纲.md)
- [第 7 课：CCComponent 挂载与更新](s07_component_lifecycle/README.md)
- [第 8 课：Scheduler 驱动组件更新](s08_scheduler_component_update/README.md)
- [第 9 课：纹理请求与缓存](s09_texture_cache/README.md)
- [第 10 课：Director 访问场景并直接绘制](s10_render_entry/README.md)
- [第 11 课：不可见节点跳过整棵子树](s11_node_visibility/README.md)
- [第 12 课：CCSprite 四顶点直接绘制](s12_sprite_quad/README.md)
- [第 13 课：CCSpriteFrame 保存贴图区域](s13_sprite_frame/README.md)
- [第 14 课：触摸输入入口](s14_touch_input/README.md)
- [第 15 课：触摸监听与命中判断](s15_touch_listener/README.md)
- [第 16 课：触摸认领与吞噬](s16_touch_swallow/README.md)
- [第 17 课：可复用节点树构造](s17_node_factory/README.md)
- [第 18 课：Sprite 实例与纹理共享](s18_sprite_resource_sharing/README.md)
- [第 19 课：组件添加与场景挂载回调](s19_instance_lifecycle/README.md)
- [第 20 课：节点退出与重新挂载](s20_node_detachment/README.md)
- [第 21 课：cleanup 与引用释放](s21_cleanup_and_release/README.md)
- [第 22 课：节点池复用](s22_node_pool/README.md)
- [第 23 课：对象池复用与未命中兜底](s23_pool_reuse_flow/README.md)
- [第 24 课：对象池容量与预热补充](s24_pool_capacity_strategy/README.md)
- [第 25 课：清池与节点存活](s25_pool_clear_lifetime/README.md)
- [第 26 课：对象池中的节点运行状态](s26_pool_runtime_lifecycle/README.md)
- [第 27 课：取出顺序与重复入池保护](s27_pool_order_and_duplicates/README.md)
- [第 28 课：节点池所有权与接收结果](s28_pool_ownership/README.md)
- [第 29 课：对象池关闭与终态](s29_pool_disposal/README.md)
- [第 30 课：动作更新链（复用第 6 课独立代码）](s06_action_scheduler/README.md)
- [第 31 课：时间进度与绝对目标插值](s31_absolute_position_interpolation/README.md)
- [第 32 课：即时回调与延迟动作](s32_instant_and_delay_actions/README.md)
- [第 33 课：串行与并行动作](s33_action_composition/README.md)
- [第 34 课：缓动、重复与反向时间](s34_action_modifiers/README.md)
- [第 35 课：设计分辨率与 Layer 根节点](s35_canvas_coordinates/README.md)
- [第 36 课：CocoStudio Widget 百分比定位](s36_widget_alignment/README.md)
- [第 37 课：CocoStudio Layout 水平排布](s37_layout/README.md)
- [第 38 课：CocoStudio Label 文本更新](s38_label_update/README.md)
- [第 39 课：CocoStudio Button 触摸回调](s39_button_interaction/README.md)
- [第 40 课：Emscripten 音效路径与 SDL_mixer](s40_audio_resource_entry/README.md)
- [第 41 课：Emscripten 音效控制](s41_audio_playback_lifecycle/README.md)
- [第 42 课：Emscripten 音量、循环与混音通道](s42_audio_concurrency_control/README.md)
- [第 43 课：应用层驱动 Box2D 世界](s43_physics_world/README.md)
- [第 44 课：应用层映射刚体与碰撞形状](s44_rigidbody_collider/README.md)
- [第 45 课：Box2D 碰撞过滤与接触监听](s45_contact_filter/README.md)
- [第 46 课：Box2D 世界查询与调试绘制](s46_physics_queries/README.md)
- [第 47 课：粒子系统创建与配置](s47_particle_system/README.md)
- [第 48 课：粒子发射与逐帧模拟](s48_particle_simulation/README.md)
- [第 49 课：粒子绘制与结束](s49_particle_render_finish/README.md)
- [第 50 课：目标选择与构建入口](s50_build_target_entry/README.md)
- [第 51 课：代码与引擎构建](s51_code_engine_build/README.md)
- [第 52 课：资源处理与产物结构](s52_resource_artifacts/README.md)
- [第 53 课：启动与交付](s53_startup_delivery/README.md)
- [第 56 课：2.x 视口与矩阵栈](s56_camera_viewport/README.md)
- [第 57 课：2.x 延迟排序与绘制顺序](s57_node_draw_order/README.md)
- [第 58 课：2.x Sprite quad 更新到 TextureAtlas](s58_sprite_quad_update/README.md)
- [第 59 课：2.x TextureAtlas VAO/VBO 上传](s59_atlas_vbo_upload/README.md)
- [第 60 课：2.x Sprite 绘制状态准备](s60_sprite_draw_state/README.md)
- [第 61 课：2.x GLProgram、ShaderCache 与 Uniform](s61_glprogram_uniforms/README.md)
- [第 62 课：2.x SpriteBatchNode 排序与图集重排](s62_texture_atlas_reorder/README.md)
- [第 63 课：2.x CCGrid3D 与模型渲染边界](s63_grid3d_shader_pipeline/README.md)
- [第 64 课：2.x Shader Sprite 直接绘制](s64_shader_scene_gl/README.md)
- [第 65 课：2.x RenderTexture 与矩阵栈](s65_kazmath_fbo_scope/README.md)
## 第 66–80 课：物理、动画与 3D 粒子

- [第 71 课：Cocos2d-x 2.x 动画资源与片段](s71_animation_clip/README.md)
- [第 72 课：Cocos2d-x 2.x 播放状态与时间推进](s72_animation_playback/README.md)
- [第 73 课：Cocos2d-x 2.x 关键帧采样与属性写回](s73_animation_sampling/README.md)
- [第 74 课：Cocos2d-x 2.x 动画事件与完成回调](s74_animation_events/README.md)
- [第 75 课：Cocos2d-x 2.x 动画组合与过渡](s75_animation_transition/README.md)

本地快照不含引擎内置 3D 物理或 3D 粒子模块，因此本课程只列出第 71–75 课动画专题。

- 每课位于独立的 `sNN_主题/` 目录，含源码、源码位置、简化说明和编译命令。
- 课程代码不依赖其他课程，也不依赖完整 Cocos2d-x 工程构建产物。

本目录只研究 `2.2.6` 这份本地快照；其他代际的课程分别维护。

## Spine 2D 骨骼动画（第 81–88 课）

- [第 81 课：Cocos2d-x 2.x Runtime 与导出资源版本兼容](s81_spine_runtime_compatibility/README.md)
- [第 82 课：Cocos2d-x 2.x SkeletonData、Atlas 与实例所有权](s82_spine_data_instance/README.md)
- [第 83 课：Cocos2d-x 2.x AnimationState、轨道与混合](s83_spine_animation_state/README.md)
- [第 84 课：Cocos2d-x 2.x 帧更新、骨骼层级与约束](s84_spine_pose_update/README.md)
- [第 85 课：Cocos2d-x 2.x Skin、Slot、Attachment 与绘制顺序](s85_spine_slots_attachments/README.md)
- [第 86 课：Cocos2d-x 2.x 网格附件、Deform 与 Clipping](s86_spine_mesh_clipping/README.md)
- [第 87 课：Cocos2d-x 2.x 引擎渲染接线与批次](s87_spine_render_submission/README.md)
- [第 88 课：Cocos2d-x 2.x 事件、调试观察与退出清理](s88_spine_events_lifecycle/README.md)

每课含独立 C++11 示例、版本对应的源码路径和编译命令。Cocos2d-x 1.x 快照没有 Spine 模块，因此不创建同名课程。

## Shader 编写与接入（第 95–101 课，已完成）

本专题按 Cocos2d-x 2.2.6 的源码路径独立实现。七课从两段 Shader 开始，逐步加入顶点输入、纹理、Uniform、Alpha、宏变体，最后追到 Sprite 绘制。

本系列每课有独立 C++11 小程序和本版源码路径。小程序用数据和日志解释职责，不创建真实 OpenGL/Metal 上下文。

- [第 95 课：Shader 源码与阶段](s95_shader_stages/README.md)
- [第 96 课：顶点输入与坐标变换](s96_vertex_inputs/README.md)
- [第 97 课：插值、纹理采样与片元颜色](s97_texture_sampling/README.md)
- [第 98 课：自定义 Uniform 与材质参数](s98_shader_uniforms/README.md)
- [第 99 课：Alpha、预乘色与混合](s99_alpha_blending/README.md)
- [第 100 课：Shader 变体与平台边界](s100_shader_variants/README.md)
- [第 101 课：Sprite 接入与调试](s101_sprite_effect_debug/README.md)
