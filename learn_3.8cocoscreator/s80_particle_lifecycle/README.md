# 第 80 课：Creator 3.8.7 停止发射与资源回收

**本课问题：** 停止发射后如何处理存活粒子和资源？

## 本版路径

stop 停止发射，renderer 仍处理存活粒子直到系统结束。

## 源码位置

- [`particle-system.ts`](<../../engine/3.8.7engine/cocos/particle/particle-system.ts>)：stop 停止发射，renderer 仍处理存活粒子直到系统结束。
- [`particle-system-renderer-base.ts`](<../../engine/3.8.7engine/cocos/particle/renderer/particle-system-renderer-base.ts>)：stop 停止发射，renderer 仍处理存活粒子直到系统结束。

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
