# 第 86 课：Cocos2d-x 4.0 网格附件、Deform 与 Clipping

**本课问题：** 附件如何生成几何，哪些版本支持网格与裁剪？

## 本版实现

MeshAttachment 生成几何；Deform 修改顶点，Clipping 会生成裁剪后的三角形。

## 源码位置

- [MeshAttachment.cpp](../../engine/cocos2d-x-4/cocos/editor-support/spine/MeshAttachment.cpp)：重点查看 MeshAttachment::computeWorldVertices。
- [SkeletonClipping.cpp](../../engine/cocos2d-x-4/cocos/editor-support/spine/SkeletonClipping.cpp)：重点查看 SkeletonClipping::clipTriangles。
- [SkeletonRenderer.cpp](../../engine/cocos2d-x-4/cocos/editor-support/spine/SkeletonRenderer.cpp)：重点查看 SkeletonRenderer::draw。

前置课程：[第 85 课](../s85_spine_slots_attachments/README.md)。本课代码仍可独立编译运行。

## 独立代码与简化

[src/cocos/editor-support/spine/SpineStudy.h](<src/cocos/editor-support/spine/SpineStudy.h>)、[src/cocos/editor-support/spine/SpineStudy.cpp](<src/cocos/editor-support/spine/SpineStudy.cpp>) 与 [main.cpp](<src/main.cpp>)。示例是独立 C++ 职责模型，不链接 Spine C++ Runtime 或真实 Renderer；v3 与 v4 Runtime / batch 分别记录。示例不复制第三方 Spine Runtime 或示例素材。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/editor-support/spine/SpineStudy.cpp -o /tmp/cocos-x4-s86
/tmp/cocos-x4-s86
~~~

输出展示本课关注的对象关系、更新步骤或渲染路径。
