# 第 87 课：Creator 3.8.7 引擎渲染接线与批次

**本课问题：** Spine 几何如何进入各版本自己的渲染路径？

## 本版实现

各版保留自己的渲染提交链路与边界。

## 源码位置

- [simple.ts](../../engine/3.8.7engine/cocos/spine/assembler/simple.ts)：重点查看 createData、updateComponentRenderData。
- [skeleton.ts](../../engine/3.8.7engine/cocos/spine/skeleton.ts)：重点查看 _render、commitMiddleware。
- [batcher-2d.ts](../../engine/3.8.7engine/cocos/2d/renderer/batcher-2d.ts)：重点查看 Batcher2D buffer commit。

前置课程：[第 86 课](../s86_spine_mesh_clipping/README.md)。本课代码仍可独立运行。
