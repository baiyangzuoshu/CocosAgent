# 第 77 课：Creator 2.4.15 粒子模拟与生命周期

**本课问题：** 粒子如何逐帧更新并到期回收？

## 本版路径

ParticleSystem3D 推进粒子 age/remainingLifetime，并更新位置和存活集合。

## 源码位置

- [`particle-system-3d.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/particle/particle-system-3d.ts>)：ParticleSystem3D 推进粒子 age/remainingLifetime，并更新位置和存活集合。
- [`particle.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/particle/particle.ts>)：ParticleSystem3D 推进粒子 age/remainingLifetime，并更新位置和存活集合。

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
