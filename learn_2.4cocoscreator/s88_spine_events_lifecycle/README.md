# 第 88 课：Creator 2.4.15 事件、调试观察与退出清理

**本课问题：** 事件如何回到游戏层，节点退出时由谁释放资源？

## 本版实现

回调通知游戏层；组件退出时解绑监听并释放实例缓存或渲染数据。

## 源码位置

- [track-entry-listeners.js](../../engine/2.4.15engine/extensions/spine/track-entry-listeners.js)：重点查看 setEventListener、setCompleteListener。
- [AttachUtil.js](../../engine/2.4.15engine/extensions/spine/AttachUtil.js)：重点查看 AttachUtil 的挂接和解绑。
- [skeleton-cache.js](../../engine/2.4.15engine/extensions/spine/skeleton-cache.js)：重点查看 SkeletonCache.destroy。

前置课程：[第 87 课](../s87_spine_render_submission/README.md)。本课代码仍可独立运行。
