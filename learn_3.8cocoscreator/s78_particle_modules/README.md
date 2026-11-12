# 第 78 课：Creator 3.8.7 粒子属性模块与曲线

**本课问题：** 随时间变化的模块如何修改粒子状态？

## 本版路径

Force/Velocity/ColorOvertime animator 由 ParticleSystem 驱动。

## 源码位置

- [`force-overtime.ts`](<../../engine/3.8.7engine/cocos/particle/animator/force-overtime.ts>)：Force/Velocity/ColorOvertime animator 由 ParticleSystem 驱动。
- [`velocity-overtime.ts`](<../../engine/3.8.7engine/cocos/particle/animator/velocity-overtime.ts>)：Force/Velocity/ColorOvertime animator 由 ParticleSystem 驱动。
- [`color-overtime.ts`](<../../engine/3.8.7engine/cocos/particle/animator/color-overtime.ts>)：Force/Velocity/ColorOvertime animator 由 ParticleSystem 驱动。

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
