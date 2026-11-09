# Cocos2d-x 1.x 源码学习

本课程以仓库快照 `engine/cocos2d-x-1/`（版本 `1.0.1-x-0.13.0-beta`）为依据，用 C++ 逐课裁出独立小程序。每课保留本代类名和源码目录，只删除当前主题无关的引擎部分。

版本标记取自 `engine/cocos2d-x-1/CHANGELOG:1`。

- [课程大纲](课程大纲.md)
- [第 7 课：Node 更新与 Scheduler](s07_node_update_schedule/README.md)
- [第 8 课：Node 定时回调](s08_interval_callback/README.md)
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
- [第 19 课：场景挂载与节点进入回调](s19_instance_lifecycle/README.md)
- [第 20 课：节点退出与重新挂载](s20_node_detachment/README.md)
- [第 21 课：cleanup 与引用释放](s21_cleanup_and_release/README.md)
- [第 22 课：节点池复用](s22_node_pool/README.md)
- [第 23 课：节点池回调与状态重置](s23_node_pool_callbacks/README.md)
- [第 24 课：对象池未命中与节点工厂兜底](s24_pool_miss_fallback/README.md)
- [第 25 课：对象池容量上限与超额节点释放](s25_pool_capacity_limit/README.md)
- 每课位于独立的 `sNN_主题/` 目录，含源码、源码位置、简化说明和编译命令。
- 课程代码不依赖其他课程，也不依赖完整 Cocos2d-x 工程构建产物。

本目录只研究 `1.0.1-x-0.13.0-beta` 这份本地快照；其他代际的课程分别维护。
