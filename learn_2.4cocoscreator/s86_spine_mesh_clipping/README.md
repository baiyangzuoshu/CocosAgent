# 第 86 课：Creator 2.4.15 网格附件、Deform 与 Clipping

**本课问题：** 附件如何生成几何，哪些版本支持网格与裁剪？

## 本版实现

MeshAttachment 生成几何；Deform 修改顶点，Clipping 会生成裁剪后的三角形。

## 源码位置

- [spine-assembler.js](../../engine/2.4.15engine/extensions/spine/spine-assembler.js)：重点查看 updateRenderData、computeWorldVertices、clipTriangles。
- [spine.js](../../engine/2.4.15engine/extensions/spine/lib/spine.js)：重点查看 MeshAttachment、SkeletonClipping。

前置课程：[第 85 课](../s85_spine_slots_attachments/README.md)。本课代码仍可独立运行。
