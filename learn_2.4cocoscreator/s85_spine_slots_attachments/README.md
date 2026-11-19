# 第 85 课：Creator 2.4.15 Skin、Slot、Attachment 与绘制顺序

**本课问题：** Skin 如何选附件，Slot 顺序如何决定绘制顺序？

## 本版实现

Skin 为 Slot 选择 Attachment，drawOrder 决定遍历顺序。

## 源码位置

- [Skeleton.js](../../engine/2.4.15engine/extensions/spine/Skeleton.js)：重点查看 setSkin、setSlotsToSetupPose。
- [spine.js](../../engine/2.4.15engine/extensions/spine/lib/spine.js)：重点查看 drawOrder、Skin.getAttachment、Slot.setAttachment。

## 本课必须保留的机制

保留 Skin 为 Slot 选择 Attachment，以及 `drawOrder` 决定 Slot 遍历顺序的关系；两者分别影响显示内容与绘制先后。

## 最小观察宿主

[`src/main.ts`](<src/main.ts>) 一次调用 `runLesson()`，打印一个附件选择和 Slot 顺序；不需要场景或帧循环。

## 模型化简化与 Creator Runtime 边界

[`SpineStudy.ts`](<src/extensions/spine/SpineStudy.ts>) 只使用普通对象和数组，不创建 Skin/Slot/Attachment，也不生成顶点；省略 Runtime `Skeleton` 应用 Skin、Attachment 并将 drawOrder 交给 Spine assembler 的阶段。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000` 查看页面日志。前置课程：[第 84 课](../s84_spine_pose_update/README.md)。
