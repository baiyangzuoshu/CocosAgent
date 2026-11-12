# 第 86 课：Cocos2d-x 2.x（2.2.6） 网格附件、Deform 与 Clipping

**本课问题：** 附件如何生成几何，哪些版本支持网格与裁剪？

## 本版实现

MeshAttachment 生成几何；Deform 修改顶点，Clipping 会生成裁剪后的三角形。

## 源码位置

- [RegionAttachment.cpp](../../engine/cocos2d-x-2/extensions/spine/RegionAttachment.cpp)：重点查看 RegionAttachment_updateQuad。
- [CCSkeleton.cpp](../../engine/cocos2d-x-2/extensions/spine/CCSkeleton.cpp)：重点查看 CCSkeleton::draw；本快照没有网格和裁剪类。

前置课程：[第 85 课](../s85_spine_slots_attachments/README.md)。本课代码仍可独立编译运行。

## 独立代码与简化

[src/extensions/spine/SpineStudy.h](<src/extensions/spine/SpineStudy.h>)、[src/extensions/spine/SpineStudy.cpp](<src/extensions/spine/SpineStudy.cpp>) 与 [main.cpp](<src/main.cpp>)。示例仅模拟该快照的 C Runtime 包装。源码没有 MeshAttachment / ClippingAttachment，也没有 AnimationState 时间线事件回调。示例不复制第三方 Spine Runtime 或示例素材。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/extensions/spine/SpineStudy.cpp -o /tmp/cocos-x2-s86
/tmp/cocos-x2-s86
~~~

输出展示本课关注的对象关系、更新步骤或渲染路径。
