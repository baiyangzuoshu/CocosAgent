# 第 60 课：Creator 3.8 MaterialInstance 与 Pass 状态

**本课问题：** 3.8 如何从 EffectAsset 创建 Pass，并让一个 Renderer 单独修改自己的材质状态？

## 本版渲染路径

`Material._createPasses()` 从 EffectAsset 当前 Technique 建立 Pass。Renderer 保留共享 Material，调用 `getMaterialInstance()` 时才创建实例；实例复制父材质 Pass 为 `PassInstance`，状态覆盖留在该实例。本课以混合开关观察共享材质与实例的区别。

## 源码位置

- [effect-asset.ts](../../engine/3.8.7engine/cocos/asset/assets/effect-asset.ts)：EffectAsset 中 Technique/Pass 数据及 blend state 描述。
- [material.ts](../../engine/3.8.7engine/cocos/asset/assets/material.ts)：`_createPasses()` 将当前 Technique 的 Pass 信息初始化为 Pass。
- [material-instance.ts](../../engine/3.8.7engine/cocos/render-scene/core/material-instance.ts)：复制父 Material，创建 PassInstance，并执行 `overridePipelineStates()`。
- [pass-instance.ts](../../engine/3.8.7engine/cocos/render-scene/core/pass-instance.ts)：PassInstance 从父 Pass 派生。
- [pass.ts](../../engine/3.8.7engine/cocos/render-scene/core/pass.ts)：Pass 初始化和管线状态覆盖入口。
- [renderer.ts](../../engine/3.8.7engine/cocos/misc/renderer.ts)：`getMaterialInstance()` 首次访问时按子模型创建实例。

## 独立代码与简化

`src/cocos/` 保留 3.8 的 Asset/Material、PassInstance 和 Renderer 分工。代码只模拟混合状态数据，不创建 GFX 设备或提交 draw；不复用 Creator 2.4 的 Effect/Technique/Pass 实现。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000/`。访问实例前 Renderer 没有 MaterialInstance；覆盖后实例的混合状态变化，共享 Pass 保持原值。
