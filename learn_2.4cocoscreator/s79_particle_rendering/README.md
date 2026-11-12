# 第 79 课：Creator 2.4.15 粒子渲染与批次

**本课问题：** 活动粒子如何变成各版本自己的绘制数据？

## 本版路径

ParticleSystem3DRenderer 把粒子交给 ParticleBatchModel 形成模型数据。

## 源码位置

- [`particle-system-3d-renderer.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/particle/renderer/particle-system-3d-renderer.ts>)：ParticleSystem3DRenderer 把粒子交给 ParticleBatchModel 形成模型数据。
- [`particle-batch-model.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/particle/renderer/particle-batch-model.ts>)：ParticleSystem3DRenderer 把粒子交给 ParticleBatchModel 形成模型数据。

前置课程：[第 49 课：粒子绘制与结束](<../s49_particle_render_finish/README.md>)。

## 独立代码与简化

[`src/cocos2d/core/3d/particle/ParticleStudy.ts`](<src/cocos2d/core/3d/particle/ParticleStudy.ts>) 与 [`src/main.ts`](<src/main.ts>)。浏览器示例只模拟粒子计数、更新与 Renderer 数据，不创建引擎 GPU 资源。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000`，页面展示发射数量、存活状态或粒子顶点数。
