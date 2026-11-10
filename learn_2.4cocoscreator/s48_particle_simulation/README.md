# 第 48 课：粒子发射与逐帧模拟

**本课问题：** 发射器怎样按时间生成粒子，再更新它们的位置与寿命？

## 观察结果

模拟器用累计时间按 `emissionRate` 发射，活动数受 `totalParticles` 限制。每个粒子带剩余寿命、速度和位置；每步先减寿命，再更新速度/位置，过期对象移出活动数组并回到对象池。

## 源码位置

- [组件 lateUpdate 驱动 Simulator.step](../../engine/2.4.15engine/cocos2d/particle/CCParticleSystem.js#L936)；[累积发射时间并受总粒子数限制](../../engine/2.4.15engine/cocos2d/particle/particle-simulator.js#L326)。
- [发射时取池对象并初始化寿命/位置](../../engine/2.4.15engine/cocos2d/particle/particle-simulator.js#L120)；[扣除寿命、更新速度和位置](../../engine/2.4.15engine/cocos2d/particle/particle-simulator.js#L363)；[过期粒子归还对象池](../../engine/2.4.15engine/cocos2d/particle/particle-simulator.js#L445)。

独立代码：[ParticleSystem](src/cocos2d/particle/CCParticleSystem.ts)、[Simulator 与对象池](src/cocos2d/particle/particle-simulator.ts) 和 [浏览器入口](src/main.ts)。

## 简化范围

保留源码的发射累计、活动粒子上限、寿命和池回收流程；速度/重力仅用确定值，省略颜色/尺寸随机化、节点坐标换算和渲染缓冲。示例用固定时间步调用 `lateUpdate`，方便观察每帧变化。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000`，观察六个时间步中的活动数量、位置和剩余寿命。
