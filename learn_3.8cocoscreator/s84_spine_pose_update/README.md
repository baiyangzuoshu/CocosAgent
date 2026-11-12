# 第 84 课：Creator 3.8.7 帧更新、骨骼层级与约束

**本课问题：** 每帧如何从动画时间推进到骨骼世界变换？

## 本版实现

从帧调度进入动画状态，再应用时间线并更新世界变换；Creator 3.8 由 SkeletonSystem.postUpdate 调度。

## 源码位置

- [skeleton-system.ts](../../engine/3.8.7engine/cocos/spine/skeleton-system.ts)：重点查看 postUpdate、prepareRenderData。
- [skeleton.ts](../../engine/3.8.7engine/cocos/spine/skeleton.ts)：重点查看 updateAnimation、updateWorldTransform。

前置课程：[第 83 课](../s83_spine_animation_state/README.md)。本课代码仍可独立运行。
