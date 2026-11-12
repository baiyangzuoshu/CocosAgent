# 第 82 课：Creator 3.8.7 SkeletonData、Atlas 与实例所有权

**本课问题：** 哪些数据可以共享，哪些状态必须由 Skeleton 实例独占？

## 本版实现

SkeletonData / Atlas 或资源缓存可以跨实例共享；动画状态、当前姿态和渲染数据属于实例。

## 源码位置

- [skeleton-data.ts](../../engine/3.8.7engine/cocos/spine/skeleton-data.ts)：重点查看 getRuntimeData、destroy。
- [skeleton-cache.ts](../../engine/3.8.7engine/cocos/spine/skeleton-cache.ts)：重点查看 setSkeletonData、_destroySkeletonInfo。
- [skeleton.ts](../../engine/3.8.7engine/cocos/spine/skeleton.ts)：重点查看 SkeletonCache.destroy。

前置课程：[第 81 课](../s81_spine_runtime_compatibility/README.md)。本课代码仍可独立运行。
