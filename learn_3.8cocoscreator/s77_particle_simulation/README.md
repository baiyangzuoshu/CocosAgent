# 第 77 课：Creator 3.8.7 粒子模拟与生命周期

**本课问题：** 粒子如何逐帧更新并到期回收？

## 本版路径

ParticleSystem 与 Particle 数据逐帧推进位置、速度和寿命。

## 源码位置

- [`particle-system.ts`](<../../engine/3.8.7engine/cocos/particle/particle-system.ts>)：ParticleSystem 与 Particle 数据逐帧推进位置、速度和寿命。
- [`particle.ts`](<../../engine/3.8.7engine/cocos/particle/particle.ts>)：ParticleSystem 与 Particle 数据逐帧推进位置、速度和寿命。
- [`particle-general-function.ts`](<../../engine/3.8.7engine/cocos/particle/particle-general-function.ts>)：ParticleSystem 与 Particle 数据逐帧推进位置、速度和寿命。

前置课程：[第 49 课：粒子绘制与结束](<../s49_particle_render_finish/README.md>)。

## 独立代码与简化

[`src/cocos/particle/ParticleStudy.ts`](<src/cocos/particle/ParticleStudy.ts>) 与 [`src/main.ts`](<src/main.ts>)。浏览器示例保留 ParticleSystem 和 renderer 分工，不创建引擎的材质或 GPU 模型。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000`，页面展示发射数量、存活状态或粒子顶点数。
