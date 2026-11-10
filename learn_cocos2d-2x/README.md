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
- [第 31 课：时间进度与绝对目标插值](s31_absolute_position_interpolation/README.md)
- [第 32 课：即时回调与延迟动作](s32_instant_and_delay_actions/README.md)
- [第 33 课：串行与并行动作](s33_action_composition/README.md)
- [第 34 课：缓动、重复与反向时间](s34_action_modifiers/README.md)
- [第 35 课：设计分辨率与 Layer 根节点](s35_canvas_coordinates/README.md)
- [第 36 课：CocoStudio Widget 百分比定位](s36_widget_alignment/README.md)
- [第 37 课：CocoStudio Layout 水平排布](s37_layout/README.md)
- [第 38 课：CocoStudio Label 文本更新](s38_label_update/README.md)
- [第 39 课：CocoStudio Button 触摸回调](s39_button_interaction/README.md)
- 每课位于独立的 `sNN_主题/` 目录，含源码、源码位置、简化说明和编译命令。
- 课程代码不依赖其他课程，也不依赖完整 Cocos2d-x 工程构建产物。

本目录只研究 `2.2.6` 这份本地快照；其他代际的课程分别维护。
