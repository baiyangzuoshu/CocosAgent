# 第 76 课：Creator 2.4.15 粒子系统配置与发射器

**本课问题：** 配置和发射形状如何创建粒子？

## 本版路径

ParticleSystem3D 累积 rateOverTime，再按 emitter 形状创建粒子。

## 源码位置

- [`particle-system-3d.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/particle/particle-system-3d.ts>)：ParticleSystem3D 累积 rateOverTime，再按 emitter 形状创建粒子。
- [`shape-module.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/particle/emitter/shape-module.ts>)：ParticleSystem3D 累积 rateOverTime，再按 emitter 形状创建粒子。

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
