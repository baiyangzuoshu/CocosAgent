# 第 82 课：Cocos2d-x 2.x（2.2.6） SkeletonData、Atlas 与实例所有权

**本课问题：** 哪些数据可以共享，哪些状态必须由 Skeleton 实例独占？

## 本版实现

SkeletonData / Atlas 或资源缓存可以跨实例共享；动画状态、当前姿态和渲染数据属于实例。

## 源码位置

- [CCSkeleton.cpp](../../engine/cocos2d-x-2/extensions/spine/CCSkeleton.cpp)：重点查看 createWithData、setSkeletonData、析构函数。
- [SkeletonData.cpp](../../engine/cocos2d-x-2/extensions/spine/SkeletonData.cpp)：重点查看 SkeletonData_dispose。

前置课程：[第 81 课](../s81_spine_runtime_compatibility/README.md)。本课代码仍可独立编译运行。

## 独立代码与简化

[src/extensions/spine/SpineStudy.h](<src/extensions/spine/SpineStudy.h>)、[src/extensions/spine/SpineStudy.cpp](<src/extensions/spine/SpineStudy.cpp>) 与 [main.cpp](<src/main.cpp>)。示例仅模拟该快照的 C Runtime 包装。源码没有 MeshAttachment / ClippingAttachment，也没有 AnimationState 时间线事件回调。示例不复制第三方 Spine Runtime 或示例素材。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/extensions/spine/SpineStudy.cpp -o /tmp/cocos-x2-s82
/tmp/cocos-x2-s82
~~~

输出展示本课关注的对象关系、更新步骤或渲染路径。
