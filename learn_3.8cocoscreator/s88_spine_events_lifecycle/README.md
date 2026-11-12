# 第 88 课：Creator 3.8.7 事件、调试观察与退出清理

**本课问题：** 事件如何回到游戏层，节点退出时由谁释放资源？

## 本版实现

回调通知游戏层；组件退出时解绑监听并释放实例缓存或渲染数据。

## 源码位置

- [track-entry-listeners.ts](../../engine/3.8.7engine/cocos/spine/track-entry-listeners.ts)：重点查看 TrackEntryListeners。
- [attach-util.ts](../../engine/3.8.7engine/cocos/spine/attach-util.ts)：重点查看 attach/detach helper。
- [skeleton.ts](../../engine/3.8.7engine/cocos/spine/skeleton.ts)：重点查看 onDisable、onDestroy、_destroySkeletonInfo。
- [skeleton-cache.ts](../../engine/3.8.7engine/cocos/spine/skeleton-cache.ts)：重点查看 数据结构与资源生命周期。

前置课程：[第 87 课](../s87_spine_render_submission/README.md)。本课代码仍可独立运行。
