# 第 76 课：Creator 2.4.15 粒子系统配置与发射器

**本课问题：** 配置和发射形状如何创建粒子？

## 本版路径

ParticleSystem3D 累积 rateOverTime，再按 emitter 形状创建粒子。

## 源码位置

- [`particle-system-3d.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/particle/particle-system-3d.ts>)：ParticleSystem3D 累积 rateOverTime，再按 emitter 形状创建粒子。
- [`shape-module.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/particle/emitter/shape-module.ts>)：ParticleSystem3D 累积 rateOverTime，再按 emitter 形状创建粒子。

前置课程：[第 49 课：粒子绘制与结束](<../s49_particle_render_finish/README.md>)。

## 本课必须保留的机制

保留按 `rateOverTime × dt` 累积发射额度、保存小数余量，并受 `capacity` 限制的规则；不足一个粒子时不能丢掉余量。

## 最小观察宿主

[`src/main.ts`](<src/main.ts>) 一次调用 `runLesson()`，用固定 `dt=0.5s` 输出发射与存活数量；无需场景、发射器对象或帧循环。

## 模型化简化与 Creator Runtime 边界

[`ParticleStudy.ts`](<src/cocos2d/core/3d/particle/ParticleStudy.ts>) 只模拟计数与容量，不创建 ParticleSystem3D、形状发射器或粒子数据；未接入 `Director → ParticleSystem3D.update → emitter` 的每帧发射阶段，也不创建 GPU 资源。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000`，页面展示发射数量、存活状态或粒子顶点数。
