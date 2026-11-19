# 第 82 课：Creator 2.4.15 SkeletonData、Atlas 与实例所有权

**本课问题：** 哪些数据可以共享，哪些状态必须由 Skeleton 实例独占？

## 本版实现

SkeletonData / Atlas 或资源缓存可以跨实例共享；动画状态、当前姿态和渲染数据属于实例。

## 源码位置

- [skeleton-data.js](../../engine/2.4.15engine/extensions/spine/skeleton-data.js)：重点查看 getRuntimeData、destroy。
- [Skeleton.js](../../engine/2.4.15engine/extensions/spine/Skeleton.js)：重点查看 setSkeletonData、setAnimationCacheMode。
- [skeleton-cache.js](../../engine/2.4.15engine/extensions/spine/skeleton-cache.js)：重点查看 getSkeletonCache。

## 本课必须保留的机制

保留 SkeletonData/Atlas 或资源缓存可跨实例共享，而动画状态、姿态和渲染数据必须由各 Skeleton 实例独占的边界。

## 最小观察宿主

[`src/main.ts`](<src/main.ts>) 一次调用 `runLesson()`，将对象共享/独占关系写入页面 `#log`；不需要场景、按钮或帧循环。

## 模型化简化与 Creator Runtime 边界

[`SpineStudy.ts`](<src/extensions/spine/SpineStudy.ts>) 只共享普通数据对象并打印姿态字符串，不加载真实 SkeletonData/Atlas 缓存，也不创建 Skeleton 实例；未执行 Runtime `Skeleton.setSkeletonData/getRuntimeData` 和 SkeletonCache 关联阶段。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000` 查看页面日志。前置课程：[第 81 课](../s81_spine_runtime_compatibility/README.md)。
