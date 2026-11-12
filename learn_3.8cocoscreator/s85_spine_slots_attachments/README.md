# 第 85 课：Creator 3.8.7 Skin、Slot、Attachment 与绘制顺序

**本课问题：** Skin 如何选附件，Slot 顺序如何决定绘制顺序？

## 本版实现

Skin 为 Slot 选择 Attachment，drawOrder 决定遍历顺序。

## 源码位置

- [skeleton.ts](../../engine/3.8.7engine/cocos/spine/skeleton.ts)：重点查看 setSkin、setSlotsToSetupPose。
- [spine-define.ts](../../engine/3.8.7engine/cocos/spine/lib/spine-define.ts)：重点查看 Skeleton drawList 与 Slot/Attachment 类型。

前置课程：[第 84 课](../s84_spine_pose_update/README.md)。本课代码仍可独立运行。
