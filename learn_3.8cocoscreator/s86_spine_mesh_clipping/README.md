# 第 86 课：Creator 3.8.7 网格附件、Deform 与 Clipping

**本课问题：** 附件如何生成几何，哪些版本支持网格与裁剪？

## 本版实现

MeshAttachment 生成几何；Deform 修改顶点，Clipping 会生成裁剪后的三角形。

## 源码位置

- [simple.ts](../../engine/3.8.7engine/cocos/spine/assembler/simple.ts)：重点查看 updateRenderData、drawList 填充。
- [attach-util.ts](../../engine/3.8.7engine/cocos/spine/attach-util.ts)：重点查看 附件顶点变换、SkeletonClipping。

前置课程：[第 85 课](../s85_spine_slots_attachments/README.md)。本课代码仍可独立运行。
