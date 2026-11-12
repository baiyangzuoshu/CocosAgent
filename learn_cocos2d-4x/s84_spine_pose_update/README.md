# 第 84 课：Cocos2d-x 4.0 帧更新、骨骼层级与约束

**本课问题：** 每帧如何从动画时间推进到骨骼世界变换？

## 本版实现

从帧调度进入动画状态，再应用时间线并更新世界变换；Creator 3.8 由 SkeletonSystem.postUpdate 调度。

## 源码位置

- [SkeletonAnimation.cpp](../../engine/cocos2d-x-4/cocos/editor-support/spine/SkeletonAnimation.cpp)：重点查看 SkeletonAnimation::update。
- [Skeleton.cpp](../../engine/cocos2d-x-4/cocos/editor-support/spine/Skeleton.cpp)：重点查看 AnimationState::update/apply、Skeleton::updateWorldTransform。
- [Bone.cpp](../../engine/cocos2d-x-4/cocos/editor-support/spine/Bone.cpp)：重点查看 Bone::updateWorldTransform。

前置课程：[第 83 课](../s83_spine_animation_state/README.md)。本课代码仍可独立编译运行。

## 独立代码与简化

[src/cocos/editor-support/spine/SpineStudy.h](<src/cocos/editor-support/spine/SpineStudy.h>)、[src/cocos/editor-support/spine/SpineStudy.cpp](<src/cocos/editor-support/spine/SpineStudy.cpp>) 与 [main.cpp](<src/main.cpp>)。示例是独立 C++ 职责模型，不链接 Spine C++ Runtime 或真实 Renderer；v3 与 v4 Runtime / batch 分别记录。示例不复制第三方 Spine Runtime 或示例素材。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/editor-support/spine/SpineStudy.cpp -o /tmp/cocos-x4-s84
/tmp/cocos-x4-s84
~~~

输出展示本课关注的对象关系、更新步骤或渲染路径。
