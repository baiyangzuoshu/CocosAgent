# 第 85 课：Creator 2.4.15 Skin、Slot、Attachment 与绘制顺序

**本课问题：** Skin 如何选附件，Slot 顺序如何决定绘制顺序？

## 本版实现

Skin 为 Slot 选择 Attachment，drawOrder 决定遍历顺序。

## 源码位置

- [Skeleton.js](../../engine/2.4.15engine/extensions/spine/Skeleton.js)：重点查看 setSkin、setSlotsToSetupPose。
- [spine.js](../../engine/2.4.15engine/extensions/spine/lib/spine.js)：重点查看 drawOrder、Skin.getAttachment、Slot.setAttachment。

前置课程：[第 84 课](../s84_spine_pose_update/README.md)。本课代码仍可独立运行。
