# 第 60 课：4.0 StateBlock 合并到 backend 管线描述

**本课问题：** 4.0 如何把 Material、Technique、Pass 各自的状态合并到一次 MeshCommand 的管线描述？

## 本版渲染路径

4.0 的 Material、Technique、Pass 都不是 3.x 那种 `RenderState` 子类；每层持有自己的 StateBlock。`RenderState::bindPass()` 取出三层状态，先恢复未显式修改的默认项，再按 Material → Technique → Pass 应用到 MeshCommand 的 `PipelineDescriptor`。Pass 在命令执行前触发这一步。本课止于描述数据，不提交 backend 命令。

## 源码位置

- [CCMaterial.h](../../engine/cocos2d-x-4/cocos/renderer/CCMaterial.h)：Material 是 Ref，并持有 Technique。
- [CCTechnique.h](../../engine/cocos2d-x-4/cocos/renderer/CCTechnique.h)：Technique 持有 Pass 与自己的状态块。
- [CCPass.cpp](../../engine/cocos2d-x-4/cocos/renderer/CCPass.cpp)：`onBeforeVisitCmd()` 调用 `RenderState::bindPass()`。
- [CCRenderState.h](../../engine/cocos2d-x-4/cocos/renderer/CCRenderState.h)：RenderState 与 StateBlock 定义。
- [CCRenderState.cpp](../../engine/cocos2d-x-4/cocos/renderer/CCRenderState.cpp)：合并层级覆盖并写入 `PipelineDescriptor`。

## 独立代码与简化

`src/cocos/renderer/` 以独立 C++ 类型展示 StateBlock → PipelineDescriptor 路径，保留本版状态合并顺序。用日志代替真实 MeshCommand、backend Device 和 OpenGL/Metal 管线创建；与 3.x 的继承式 RenderState 分开实现。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/renderer/CCRenderState.cpp src/cocos/renderer/CCMaterial.cpp src/cocos/renderer/CCTechnique.cpp src/cocos/renderer/CCPass.cpp -o /tmp/cocos2d-4x-s60
/tmp/cocos2d-4x-s60
~~~

输出中 Technique 覆盖 Material 的混合因子，Pass 再把深度测试写入最终管线描述。
