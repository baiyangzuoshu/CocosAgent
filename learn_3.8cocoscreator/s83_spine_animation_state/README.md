# 第 83 课：Creator 3.8.7 AnimationState、轨道与混合

**本课问题：** 播放、排队和混合怎样改变当前动画状态？

## 本版实现

setAnimation 替换指定播放单元，addAnimation 排队；mix 配置描述切换时长。

## 源码位置

- [skeleton.ts](../../engine/3.8.7engine/cocos/spine/skeleton.ts)：重点查看 setAnimation、addAnimation、setMix。
- [track-entry-listeners.ts](../../engine/3.8.7engine/cocos/spine/track-entry-listeners.ts)：重点查看 TrackEntry listener。

前置课程：[第 82 课](../s82_spine_data_instance/README.md)。本课代码仍可独立运行。
