# 第 84 课：Cocos2d-x 2.x（2.2.6） 帧更新、骨骼层级与约束

**本课问题：** 每帧如何从动画时间推进到骨骼世界变换？

## 本版实现

从帧调度进入动画状态，再应用时间线并更新世界变换；Creator 3.8 由 SkeletonSystem.postUpdate 调度。

## 源码位置

- [CCSkeletonAnimation.cpp](../../engine/cocos2d-x-2/extensions/spine/CCSkeletonAnimation.cpp)：重点查看 CCSkeletonAnimation::update。
- [Skeleton.cpp](../../engine/cocos2d-x-2/extensions/spine/Skeleton.cpp)：重点查看 Skeleton_updateWorldTransform。
- [Bone.cpp](../../engine/cocos2d-x-2/extensions/spine/Bone.cpp)：重点查看 Bone_updateWorldTransform。

前置课程：[第 83 课](../s83_spine_animation_state/README.md)。本课代码仍可独立编译运行。

## 独立代码与简化

[src/extensions/spine/SpineStudy.h](<src/extensions/spine/SpineStudy.h>)、[src/extensions/spine/SpineStudy.cpp](<src/extensions/spine/SpineStudy.cpp>) 与 [main.cpp](<src/main.cpp>)。示例仅模拟该快照的 C Runtime 包装。源码没有 MeshAttachment / ClippingAttachment，也没有 AnimationState 时间线事件回调。示例不复制第三方 Spine Runtime 或示例素材。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/extensions/spine/SpineStudy.cpp -o /tmp/cocos-x2-s84
/tmp/cocos-x2-s84
~~~

输出展示本课关注的对象关系、更新步骤或渲染路径。
