# 第 82 课：Cocos2d-x 4.0 SkeletonData、Atlas 与实例所有权

**本课问题：** 哪些数据可以共享，哪些状态必须由 Skeleton 实例独占？

## 本版实现

SkeletonData / Atlas 或资源缓存可以跨实例共享；动画状态、当前姿态和渲染数据属于实例。

## 源码位置

- [SkeletonRenderer.cpp](../../engine/cocos2d-x-4/cocos/editor-support/spine/SkeletonRenderer.cpp)：重点查看 initWithData、setSkeletonData、析构函数。
- [SkeletonData.cpp](../../engine/cocos2d-x-4/cocos/editor-support/spine/SkeletonData.cpp)：重点查看 _ownsSkeletonData、_ownsAtlas。

前置课程：[第 81 课](../s81_spine_runtime_compatibility/README.md)。本课代码仍可独立编译运行。

## 独立代码与简化

[src/cocos/editor-support/spine/SpineStudy.h](<src/cocos/editor-support/spine/SpineStudy.h>)、[src/cocos/editor-support/spine/SpineStudy.cpp](<src/cocos/editor-support/spine/SpineStudy.cpp>) 与 [main.cpp](<src/main.cpp>)。示例是独立 C++ 职责模型，不链接 Spine C++ Runtime 或真实 Renderer；v3 与 v4 Runtime / batch 分别记录。示例不复制第三方 Spine Runtime 或示例素材。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/editor-support/spine/SpineStudy.cpp -o /tmp/cocos-x4-s82
/tmp/cocos-x4-s82
~~~

输出展示本课关注的对象关系、更新步骤或渲染路径。
