# 第 87 课：Cocos2d-x 4.0 引擎渲染接线与批次

**本课问题：** Spine 几何如何进入各版本自己的渲染路径？

## 本版实现

各版保留自己的渲染提交链路与边界。

## 源码位置

- [SkeletonRenderer.cpp](../../engine/cocos2d-x-4/cocos/editor-support/spine/SkeletonRenderer.cpp)：重点查看 SkeletonRenderer::draw、TrianglesCommand。
- [SkeletonBatch.cpp](../../engine/cocos2d-x-4/cocos/editor-support/spine/v3/SkeletonBatch.cpp)：重点查看 v3 / v4 SkeletonBatch::addCommand。
- [SkeletonBatch.cpp](../../engine/cocos2d-x-4/cocos/editor-support/spine/v4/SkeletonBatch.cpp)：重点查看 Renderer/backend execution。

前置课程：[第 86 课](../s86_spine_mesh_clipping/README.md)。本课代码仍可独立编译运行。

## 独立代码与简化

[src/cocos/editor-support/spine/SpineStudy.h](<src/cocos/editor-support/spine/SpineStudy.h>)、[src/cocos/editor-support/spine/SpineStudy.cpp](<src/cocos/editor-support/spine/SpineStudy.cpp>) 与 [main.cpp](<src/main.cpp>)。示例是独立 C++ 职责模型，不链接 Spine C++ Runtime 或真实 Renderer；v3 与 v4 Runtime / batch 分别记录。示例不复制第三方 Spine Runtime 或示例素材。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/editor-support/spine/SpineStudy.cpp -o /tmp/cocos-x4-s87
/tmp/cocos-x4-s87
~~~

输出展示本课关注的对象关系、更新步骤或渲染路径。
