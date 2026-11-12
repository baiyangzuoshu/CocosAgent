# 第 85 课：Cocos2d-x 2.x（2.2.6） Skin、Slot、Attachment 与绘制顺序

**本课问题：** Skin 如何选附件，Slot 顺序如何决定绘制顺序？

## 本版实现

Skin 为 Slot 选择 Attachment，drawOrder 决定遍历顺序。

## 源码位置

- [Skeleton.cpp](../../engine/cocos2d-x-2/extensions/spine/Skeleton.cpp)：重点查看 Skeleton slots / drawOrder。
- [Slot.cpp](../../engine/cocos2d-x-2/extensions/spine/Slot.cpp)：重点查看 Skin_getAttachment、Slot_setAttachment。
- [Skin.cpp](../../engine/cocos2d-x-2/extensions/spine/Skin.cpp)：重点查看 Skin attachment lookup。
- [RegionAttachment.cpp](../../engine/cocos2d-x-2/extensions/spine/RegionAttachment.cpp)：重点查看 RegionAttachment_updateQuad。

前置课程：[第 84 课](../s84_spine_pose_update/README.md)。本课代码仍可独立编译运行。

## 独立代码与简化

[src/extensions/spine/SpineStudy.h](<src/extensions/spine/SpineStudy.h>)、[src/extensions/spine/SpineStudy.cpp](<src/extensions/spine/SpineStudy.cpp>) 与 [main.cpp](<src/main.cpp>)。示例仅模拟该快照的 C Runtime 包装。源码没有 MeshAttachment / ClippingAttachment，也没有 AnimationState 时间线事件回调。示例不复制第三方 Spine Runtime 或示例素材。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/extensions/spine/SpineStudy.cpp -o /tmp/cocos-x2-s85
/tmp/cocos-x2-s85
~~~

输出展示本课关注的对象关系、更新步骤或渲染路径。
