# 第 77 课：Creator 2.4.15 粒子模拟与生命周期

**本课问题：** 粒子如何逐帧更新并到期回收？

## 本版路径

ParticleSystem3D 推进粒子 age/remainingLifetime，并更新位置和存活集合。

## 源码位置

- [`particle-system-3d.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/particle/particle-system-3d.ts>)：ParticleSystem3D 推进粒子 age/remainingLifetime，并更新位置和存活集合。
- [`particle.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/particle/particle.ts>)：ParticleSystem3D 推进粒子 age/remainingLifetime，并更新位置和存活集合。

前置课程：[第 49 课：粒子绘制与结束](<../s49_particle_render_finish/README.md>)。

## 为什么这样设计

每个粒子保存自身年龄、寿命和运动状态，System 在同一帧推进它们并移除过期项。这样发射器与属性模块可以只处理活动粒子，不必各自管理生命周期。

## 源码流程图

```mermaid
flowchart TD
 A[活动粒子集合] --> B[ParticleSystem3D.update dt]
 B --> C[age += dt]
 C --> D[按速度积分位置]
 D --> E{age >= lifetime?}
 E -->|否| F[保留到下帧]
 E -->|是| G[从活动集合移除]
 F --> H[更新活动列表]
 G --> H
```

## 本课必须保留的机制

保留每步推进粒子 `age`、按速度积分位置，以及超出 `lifetime` 后从存活集合移除的顺序。

## 最小观察宿主

[`src/main.ts`](<src/main.ts>) 一次调用 `runLesson()`，只做固定 `dt=0.2s` 的一步更新并打印存活数和位置；无需场景或帧循环。

## 模型化简化与 Creator Runtime 边界

课程代码对存活粒子推进年龄与位置，将过期粒子移入回收数组，并报告存活数和回收数。回收数组只展示生命周期分流，不实现对象复用；模型也不接入 Creator Runtime `ParticleSystem3D` 或 Renderer，不创建 GPU 资源。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000`，页面展示发射数量、存活状态或粒子顶点数。
