# 第 76 课：Creator 3.8.7 粒子系统配置与发射器

**本课问题：** 配置和发射形状如何创建粒子？

## 本版路径

ParticleSystem 累积 emission rate，由 shape module 生成粒子初始数据。

## 源码位置

- [`particle-system.ts`](<../../engine/3.8.7engine/cocos/particle/particle-system.ts>)：ParticleSystem 累积 emission rate，由 shape module 生成粒子初始数据。
- [`shape-module.ts`](<../../engine/3.8.7engine/cocos/particle/emitter/shape-module.ts>)：ParticleSystem 累积 emission rate，由 shape module 生成粒子初始数据。
- [`particle.ts`](<../../engine/3.8.7engine/cocos/particle/particle.ts>)：ParticleSystem 累积 emission rate，由 shape module 生成粒子初始数据。

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
