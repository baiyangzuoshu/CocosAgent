# 第 84 课：Creator 2.4.15 帧更新、骨骼层级与约束

**本课问题：** 每帧如何从动画时间推进到骨骼世界变换？

## 本版实现

从帧调度进入动画状态，再应用时间线并更新世界变换；Creator 3.8 由 SkeletonSystem.postUpdate 调度。

## 源码位置

- [Skeleton.js](../../engine/2.4.15engine/extensions/spine/Skeleton.js)：重点查看 update、_updateRealtime、updateWorldTransform。
- [spine.js](../../engine/2.4.15engine/extensions/spine/lib/spine.js)：重点查看 Bone.updateWorldTransform。

## 本课必须保留的机制

保留帧更新的职责顺序：推进 AnimationState、应用时间线、再计算骨骼世界变换；父子层级的局部变换需要组合成世界位置。

## 最小观察宿主

[`src/main.ts`](<src/main.ts>) 一次调用 `runLesson()`，打印更新顺序与一个父子 X 值示例；没有真实帧循环。

## 模型化简化与 Creator Runtime 边界

[`SpineStudy.ts`](<src/extensions/spine/SpineStudy.ts>) 只打印调用顺序并相加两个局部 X 值，不执行 Skeleton/AnimationState、矩阵变换或约束求解；省略 2.4 Runtime `Skeleton.update → _updateRealtime → updateWorldTransform` 的逐帧阶段。README 对 3.8 `SkeletonSystem.postUpdate` 的描述是版本对照，不代表本例接入该系统。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000` 查看页面日志。前置课程：[第 83 课](../s83_spine_animation_state/README.md)。
