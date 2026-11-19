# 第 86 课：Creator 2.4.15 网格附件、Deform 与 Clipping

**本课问题：** 附件如何生成几何，哪些版本支持网格与裁剪？

## 本版实现

MeshAttachment 生成几何；Deform 修改顶点，Clipping 会生成裁剪后的三角形。

## 源码位置

- [spine-assembler.js](../../engine/2.4.15engine/extensions/spine/spine-assembler.js)：重点查看 updateRenderData、computeWorldVertices、clipTriangles。
- [spine.js](../../engine/2.4.15engine/extensions/spine/lib/spine.js)：重点查看 MeshAttachment、SkeletonClipping。

## 本课必须保留的机制

保留 MeshAttachment 提供顶点/三角形、Deform 修改顶点、Clipping 在上传前产生裁剪几何的先后关系。

## 最小观察宿主

[`src/main.ts`](<src/main.ts>) 一次调用 `runLesson()`，打印网格计数及 Deform/Clipping 标签；不需要场景或帧循环。

## 模型化简化与 Creator Runtime 边界

[`SpineStudy.ts`](<src/extensions/spine/SpineStudy.ts>) 只打印固定计数和概念文字，不计算世界顶点、不执行 deform 或裁剪；省略 `computeWorldVertices → SkeletonClipping.clipTriangles → buffer upload` 的真实 Runtime 几何阶段，也不创建 GPU Buffer。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000` 查看页面日志。前置课程：[第 85 课](../s85_spine_slots_attachments/README.md)。
