# 第 80 课：Creator 2.4.15 停止发射与资源回收

**本课问题：** 停止发射后如何处理存活粒子和资源？

## 本版路径

停止新发射后继续模拟剩余粒子，粒子清空后结束渲染。

## 源码位置

- [`particle-system-3d.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/particle/particle-system-3d.ts>)：停止新发射后继续模拟剩余粒子，粒子清空后结束渲染。
- [`particle-system-3d-renderer.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/particle/renderer/particle-system-3d-renderer.ts>)：停止新发射后继续模拟剩余粒子，粒子清空后结束渲染。

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
