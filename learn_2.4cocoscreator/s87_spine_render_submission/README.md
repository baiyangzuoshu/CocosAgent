# 第 87 课：Creator 2.4.15 引擎渲染接线与批次

**本课问题：** Spine 几何如何进入各版本自己的渲染路径？

## 本版实现

各版保留自己的渲染提交链路与边界。

## 源码位置

- [spine-assembler.js](../../engine/2.4.15engine/extensions/spine/spine-assembler.js)：重点查看 updateRenderData、Renderer._flush。
- [spine-buffer.js](../../engine/2.4.15engine/cocos2d/core/renderer/webgl/spine-buffer.js)：重点查看 spine buffer 顶点/索引上传。

前置课程：[第 86 课](../s86_spine_mesh_clipping/README.md)。本课代码仍可独立运行。
