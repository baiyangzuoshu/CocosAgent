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

历史 Cocos2d-x 第 23 课：[1.x](../learn_cocos2d-1x/s23_pool_reuse_flow/README.md)、[2.x](../learn_cocos2d-2x/s23_pool_reuse_flow/README.md)、[3.x](../learn_cocos2d-3x/s23_pool_reuse_flow/README.md)。

历史 Cocos2d-x 第 24 课：[1.x](../learn_cocos2d-1x/s24_pool_capacity_strategy/README.md)、[2.x](../learn_cocos2d-2x/s24_pool_capacity_strategy/README.md)、[3.x](../learn_cocos2d-3x/s24_pool_capacity_strategy/README.md)。

历史 Cocos2d-x 第 25 课：[1.x](../learn_cocos2d-1x/s25_pool_clear_lifetime/README.md)、[2.x](../learn_cocos2d-2x/s25_pool_clear_lifetime/README.md)、[3.x](../learn_cocos2d-3x/s25_pool_clear_lifetime/README.md)。

历史 Cocos2d-x 第 26 课：[1.x](../learn_cocos2d-1x/s26_pool_runtime_lifecycle/README.md)、[2.x](../learn_cocos2d-2x/s26_pool_runtime_lifecycle/README.md)、[3.x](../learn_cocos2d-3x/s26_pool_runtime_lifecycle/README.md)。

历史 Cocos2d-x 第 27 课：[1.x](../learn_cocos2d-1x/s27_pool_order_and_duplicates/README.md)、[2.x](../learn_cocos2d-2x/s27_pool_order_and_duplicates/README.md)、[3.x](../learn_cocos2d-3x/s27_pool_order_and_duplicates/README.md)。

历史 Cocos2d-x 第 28 课：[1.x](../learn_cocos2d-1x/s28_pool_ownership/README.md)、[2.x](../learn_cocos2d-2x/s28_pool_ownership/README.md)、[3.x](../learn_cocos2d-3x/s28_pool_ownership/README.md)。

历史 Cocos2d-x 第 29 课：[1.x](../learn_cocos2d-1x/s29_pool_disposal/README.md)、[2.x](../learn_cocos2d-2x/s29_pool_disposal/README.md)、[3.x](../learn_cocos2d-3x/s29_pool_disposal/README.md)。
