# 第 78 课：Creator 2.4.15 粒子属性模块与曲线

**本课问题：** 随时间变化的模块如何修改粒子状态？

## 本版路径

ForceOvertime 与 ColorOvertime 等模块按系统归一化时间修改粒子。

## 源码位置

- [`particle-system-3d.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/particle/particle-system-3d.ts>)：ForceOvertime 与 ColorOvertime 等模块按系统归一化时间修改粒子。
- [`force-overtime.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/particle/animator/force-overtime.ts>)：ForceOvertime 与 ColorOvertime 等模块按系统归一化时间修改粒子。
- [`color-overtime.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/particle/animator/color-overtime.ts>)：ForceOvertime 与 ColorOvertime 等模块按系统归一化时间修改粒子。

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
