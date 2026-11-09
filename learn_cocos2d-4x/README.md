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
| 第 23 课：节点池回调与状态重置 | [本课](s23_node_pool_callbacks/README.md) | [本课](../learn_2.4cocoscreator/s23_node_pool_callbacks/README.md) | [本课](../learn_3.8cocoscreator/s23_node_pool_callbacks/README.md) |
| 第 24 课：对象池未命中与节点工厂兜底 | [本课](s24_pool_miss_fallback/README.md) | [本课](../learn_2.4cocoscreator/s24_pool_miss_fallback/README.md) | [本课](../learn_3.8cocoscreator/s24_pool_miss_fallback/README.md) |
| 第 25 课：对象池容量上限与超额销毁 | [本课](s25_pool_capacity_limit/README.md) | [本课](../learn_2.4cocoscreator/s25_pool_capacity_limit/README.md) | [本课](../learn_3.8cocoscreator/s25_pool_capacity_limit/README.md) |
| 第 26 课：对象池预热与首次复用 | [本课](s26_pool_prewarm/README.md) | [本课](../learn_2.4cocoscreator/s26_pool_prewarm/README.md) | [本课](../learn_3.8cocoscreator/s26_pool_prewarm/README.md) |
| 第 27 课：对象池低水位补充 | [本课](s27_pool_low_water_refill/README.md) | [本课](../learn_2.4cocoscreator/s27_pool_low_water_refill/README.md) | [本课](../learn_3.8cocoscreator/s27_pool_low_water_refill/README.md) |
| 第 28 课：对象池 clear 的销毁时机 | [本课](s28_pool_clear_timing/README.md) | [本课](../learn_2.4cocoscreator/s28_pool_clear_timing/README.md) | [本课](../learn_3.8cocoscreator/s28_pool_clear_timing/README.md) |
| 第 29 课：外部引用与对象池清理 | [本课](s29_pool_external_owner/README.md) | [本课](../learn_2.4cocoscreator/s29_pool_external_owner/README.md) | [本课](../learn_3.8cocoscreator/s29_pool_external_owner/README.md) |
| 第 30 课：池中节点暂停调度 | [本课](s30_pool_activity_pause/README.md) | [本课](../learn_2.4cocoscreator/s30_pool_activity_pause/README.md) | [本课](../learn_3.8cocoscreator/s30_pool_activity_pause/README.md) |
| 第 31 课：回收与清理的区别 | [本课](s31_pool_cleanup_policy/README.md) | [本课](../learn_2.4cocoscreator/s31_pool_cleanup_policy/README.md) | [本课](../learn_3.8cocoscreator/s31_pool_cleanup_policy/README.md) |
| 第 32 课：节点池的后进先出顺序 | [本课](s32_pool_lifo_order/README.md) | [本课](../learn_2.4cocoscreator/s32_pool_lifo_order/README.md) | [本课](../learn_3.8cocoscreator/s32_pool_lifo_order/README.md) |
| 第 33 课：防止节点重复入池 | [本课](s33_pool_duplicate_put/README.md) | [本课](../learn_2.4cocoscreator/s33_pool_duplicate_put/README.md) | [本课](../learn_3.8cocoscreator/s33_pool_duplicate_put/README.md) |
| 第 34 课：同一节点跨池共享的风险 | [本课](s34_pool_cross_pool_identity/README.md) | [本课](../learn_2.4cocoscreator/s34_pool_cross_pool_identity/README.md) | [本课](../learn_3.8cocoscreator/s34_pool_cross_pool_identity/README.md) |
| 第 35 课：限制节点同时归属多个池 | [本课](s35_pool_single_owner/README.md) | [本课](../learn_2.4cocoscreator/s35_pool_single_owner/README.md) | [本课](../learn_3.8cocoscreator/s35_pool_single_owner/README.md) |
| 第 36 课：对象池 dispose 后禁止继续使用 | [本课](s36_pool_dispose/README.md) | [本课](../learn_2.4cocoscreator/s36_pool_dispose/README.md) | [本课](../learn_3.8cocoscreator/s36_pool_dispose/README.md) |
| 第 37 课：区分空池与已关闭池 | [本课](s37_pool_state_query/README.md) | [本课](../learn_2.4cocoscreator/s37_pool_state_query/README.md) | [本课](../learn_3.8cocoscreator/s37_pool_state_query/README.md) |
| 第 38 课：重复 dispose 保持同一终态 | [本课](s38_pool_dispose_idempotence/README.md) | [本课](../learn_2.4cocoscreator/s38_pool_dispose_idempotence/README.md) | [本课](../learn_3.8cocoscreator/s38_pool_dispose_idempotence/README.md) |

历史 Cocos2d-x 同主题：[1.x](../learn_cocos2d-1x/s09_texture_cache/README.md)、[2.x](../learn_cocos2d-2x/s09_texture_cache/README.md)、[3.x](../learn_cocos2d-3x/s09_texture_cache/README.md)。

历史 Cocos2d-x 第 10 课：[1.x](../learn_cocos2d-1x/s10_render_entry/README.md)、[2.x](../learn_cocos2d-2x/s10_render_entry/README.md)、[3.x](../learn_cocos2d-3x/s10_render_entry/README.md)。

历史 Cocos2d-x 第 11 课：[1.x](../learn_cocos2d-1x/s11_node_visibility/README.md)、[2.x](../learn_cocos2d-2x/s11_node_visibility/README.md)、[3.x](../learn_cocos2d-3x/s11_global_z_order/README.md)。

历史 Cocos2d-x 第 12 课：[1.x](../learn_cocos2d-1x/s12_sprite_quad/README.md)、[2.x](../learn_cocos2d-2x/s12_sprite_quad/README.md)、[3.x](../learn_cocos2d-3x/s12_sprite_triangles/README.md)。

历史 Cocos2d-x 第 13 课：[1.x](../learn_cocos2d-1x/s13_sprite_frame/README.md)、[2.x](../learn_cocos2d-2x/s13_sprite_frame/README.md)、[3.x](../learn_cocos2d-3x/s13_sprite_frame_texture/README.md)。

各课程独立阅读和运行；表格用于快速打开同主题内容。

历史 Cocos2d-x 第 14 课：[1.x](../learn_cocos2d-1x/s14_touch_input/README.md)、[2.x](../learn_cocos2d-2x/s14_touch_input/README.md)、[3.x](../learn_cocos2d-3x/s14_touch_input/README.md)。

历史 Cocos2d-x 第 15 课：[1.x](../learn_cocos2d-1x/s15_touch_listener/README.md)、[2.x](../learn_cocos2d-2x/s15_touch_listener/README.md)、[3.x](../learn_cocos2d-3x/s15_touch_listener/README.md)。

历史 Cocos2d-x 第 16 课：[1.x](../learn_cocos2d-1x/s16_touch_swallow/README.md)、[2.x](../learn_cocos2d-2x/s16_touch_swallow/README.md)、[3.x](../learn_cocos2d-3x/s16_touch_swallow/README.md)。

历史 Cocos2d-x 第 17 课：[1.x](../learn_cocos2d-1x/s17_node_factory/README.md)、[2.x](../learn_cocos2d-2x/s17_node_factory/README.md)、[3.x](../learn_cocos2d-3x/s17_node_factory/README.md)。Cocos2d-x 用节点树构造器复用结构，Creator 使用 Prefab 资源实例化。

历史 Cocos2d-x 第 18 课：[1.x](../learn_cocos2d-1x/s18_sprite_resource_sharing/README.md)、[2.x](../learn_cocos2d-2x/s18_sprite_resource_sharing/README.md)、[3.x](../learn_cocos2d-3x/s18_sprite_resource_sharing/README.md)。1.x/2.x 显示 Sprite 共享纹理；3.x/4.x 显示 SpriteFrame 引用共享。

历史 Cocos2d-x 第 19 课：[1.x](../learn_cocos2d-1x/s19_instance_lifecycle/README.md)、[2.x](../learn_cocos2d-2x/s19_instance_lifecycle/README.md)、[3.x](../learn_cocos2d-3x/s19_instance_lifecycle/README.md)。各代回调时机不同，详见课内源码位置。

历史 Cocos2d-x 第 20 课：[1.x](../learn_cocos2d-1x/s20_node_detachment/README.md)、[2.x](../learn_cocos2d-2x/s20_node_detachment/README.md)、[3.x](../learn_cocos2d-3x/s20_node_detachment/README.md)。

历史 Cocos2d-x 第 21 课：[1.x](../learn_cocos2d-1x/s21_cleanup_and_release/README.md)、[2.x](../learn_cocos2d-2x/s21_cleanup_and_release/README.md)、[3.x](../learn_cocos2d-3x/s21_cleanup_and_release/README.md)。

历史 Cocos2d-x 第 22 课：[1.x](../learn_cocos2d-1x/s22_node_pool/README.md)、[2.x](../learn_cocos2d-2x/s22_node_pool/README.md)、[3.x](../learn_cocos2d-3x/s22_node_pool/README.md)。

历史 Cocos2d-x 第 23 课：[1.x](../learn_cocos2d-1x/s23_node_pool_callbacks/README.md)、[2.x](../learn_cocos2d-2x/s23_node_pool_callbacks/README.md)、[3.x](../learn_cocos2d-3x/s23_node_pool_callbacks/README.md)。

历史 Cocos2d-x 第 24 课：[1.x](../learn_cocos2d-1x/s24_pool_miss_fallback/README.md)、[2.x](../learn_cocos2d-2x/s24_pool_miss_fallback/README.md)、[3.x](../learn_cocos2d-3x/s24_pool_miss_fallback/README.md)。

历史 Cocos2d-x 第 25 课：[1.x](../learn_cocos2d-1x/s25_pool_capacity_limit/README.md)、[2.x](../learn_cocos2d-2x/s25_pool_capacity_limit/README.md)、[3.x](../learn_cocos2d-3x/s25_pool_capacity_limit/README.md)。

历史 Cocos2d-x 第 26 课：[1.x](../learn_cocos2d-1x/s26_pool_prewarm/README.md)、[2.x](../learn_cocos2d-2x/s26_pool_prewarm/README.md)、[3.x](../learn_cocos2d-3x/s26_pool_prewarm/README.md)。

历史 Cocos2d-x 第 27 课：[1.x](../learn_cocos2d-1x/s27_pool_low_water_refill/README.md)、[2.x](../learn_cocos2d-2x/s27_pool_low_water_refill/README.md)、[3.x](../learn_cocos2d-3x/s27_pool_low_water_refill/README.md)。

历史 Cocos2d-x 第 28 课：[1.x](../learn_cocos2d-1x/s28_pool_clear_timing/README.md)、[2.x](../learn_cocos2d-2x/s28_pool_clear_timing/README.md)、[3.x](../learn_cocos2d-3x/s28_pool_clear_timing/README.md)。

历史 Cocos2d-x 第 29 课：[1.x](../learn_cocos2d-1x/s29_pool_external_owner/README.md)、[2.x](../learn_cocos2d-2x/s29_pool_external_owner/README.md)、[3.x](../learn_cocos2d-3x/s29_pool_external_owner/README.md)。

历史 Cocos2d-x 第 30 课：[1.x](../learn_cocos2d-1x/s30_pool_activity_pause/README.md)、[2.x](../learn_cocos2d-2x/s30_pool_activity_pause/README.md)、[3.x](../learn_cocos2d-3x/s30_pool_activity_pause/README.md)。

历史 Cocos2d-x 第 31 课：[1.x](../learn_cocos2d-1x/s31_pool_cleanup_policy/README.md)、[2.x](../learn_cocos2d-2x/s31_pool_cleanup_policy/README.md)、[3.x](../learn_cocos2d-3x/s31_pool_cleanup_policy/README.md)。

历史 Cocos2d-x 第 32 课：[1.x](../learn_cocos2d-1x/s32_pool_lifo_order/README.md)、[2.x](../learn_cocos2d-2x/s32_pool_lifo_order/README.md)、[3.x](../learn_cocos2d-3x/s32_pool_lifo_order/README.md)。

历史 Cocos2d-x 第 33 课：[1.x](../learn_cocos2d-1x/s33_pool_duplicate_put/README.md)、[2.x](../learn_cocos2d-2x/s33_pool_duplicate_put/README.md)、[3.x](../learn_cocos2d-3x/s33_pool_duplicate_put/README.md)。

历史 Cocos2d-x 第 34 课：[1.x](../learn_cocos2d-1x/s34_pool_cross_pool_identity/README.md)、[2.x](../learn_cocos2d-2x/s34_pool_cross_pool_identity/README.md)、[3.x](../learn_cocos2d-3x/s34_pool_cross_pool_identity/README.md)。

历史 Cocos2d-x 第 35 课：[1.x](../learn_cocos2d-1x/s35_pool_single_owner/README.md)、[2.x](../learn_cocos2d-2x/s35_pool_single_owner/README.md)、[3.x](../learn_cocos2d-3x/s35_pool_single_owner/README.md)。

历史 Cocos2d-x 第 36 课：[1.x](../learn_cocos2d-1x/s36_pool_dispose/README.md)、[2.x](../learn_cocos2d-2x/s36_pool_dispose/README.md)、[3.x](../learn_cocos2d-3x/s36_pool_dispose/README.md)。

历史 Cocos2d-x 第 37 课：[1.x](../learn_cocos2d-1x/s37_pool_state_query/README.md)、[2.x](../learn_cocos2d-2x/s37_pool_state_query/README.md)、[3.x](../learn_cocos2d-3x/s37_pool_state_query/README.md)。

历史 Cocos2d-x 第 38 课：[1.x](../learn_cocos2d-1x/s38_pool_dispose_idempotence/README.md)、[2.x](../learn_cocos2d-2x/s38_pool_dispose_idempotence/README.md)、[3.x](../learn_cocos2d-3x/s38_pool_dispose_idempotence/README.md)。
