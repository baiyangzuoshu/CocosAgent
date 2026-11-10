# 第 48 课：粒子发射与逐帧模拟

**本课问题：** 2.x 如何按发射间隔生成粒子、更新速度与寿命？

## 观察结果

`update` 累积时间并按发射率调用 `addParticle`。粒子放进固定数组的活动前缀；每帧扣减寿命、更新位置，过期时将最后一个活动粒子搬到空位。

## 源码位置

- [`addParticle` 初始化并推进活动数](../../engine/cocos2d-x-2/cocos2dx/particle_nodes/CCParticleSystem.cpp#L454)；[`initParticle` 初始化寿命和速度](../../engine/cocos2d-x-2/cocos2dx/particle_nodes/CCParticleSystem.cpp#L468)。
- [`update` 发射计时](../../engine/cocos2d-x-2/cocos2dx/particle_nodes/CCParticleSystem.cpp#L603)；[寿命递减、运动更新和过期交换移除](../../engine/cocos2d-x-2/cocos2dx/particle_nodes/CCParticleSystem.cpp#L740)。

独立代码：[基础粒子系统](src/cocos2dx/particle_nodes/CCParticleSystem.h)、[Quad 子类](src/cocos2dx/particle_nodes/CCParticleSystemQuad.h) 及对应 `.cpp`、[程序入口](src/main.cpp)。

## 简化范围

保留固定粒子数组、发射累计、寿命更新和活动区交换移除；速度/重力用确定值。省略随机属性、Quad 顶点更新和 VBO 提交。

## 运行

~~~sh
c++ -std=c++11 -Wall -Wextra -pedantic -Isrc src/main.cpp src/cocos2dx/particle_nodes/CCParticleSystem.cpp src/cocos2dx/particle_nodes/CCParticleSystemQuad.cpp -o /tmp/cocos2d-2x-s48
/tmp/cocos2d-2x-s48
~~~
