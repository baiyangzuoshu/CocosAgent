# 第 48 课：粒子发射与逐帧模拟

**本课问题：** 1.x 如何按发射间隔生成粒子、更新速度与寿命？

## 观察结果

`update` 用发射计时器调用 `addParticle`，并在容量内递增活动数。每个活动粒子扣减寿命、更新位置；过期时用最后一个粒子覆盖当前位置，活动区缩短。

## 源码位置

- [`addParticle` 初始化并推进活动数](../../engine/cocos2d-x-1/cocos2dx/particle_nodes/CCParticleSystem.cpp#L388)；[`initParticle` 写入寿命和发射速度](../../engine/cocos2d-x-1/cocos2dx/particle_nodes/CCParticleSystem.cpp#L401)。
- [`update` 按发射率生成粒子](../../engine/cocos2d-x-1/cocos2dx/particle_nodes/CCParticleSystem.cpp#L532)；[寿命递减、位置更新和过期交换移除](../../engine/cocos2d-x-1/cocos2dx/particle_nodes/CCParticleSystem.cpp#L658)。

独立代码：[基础粒子系统](src/cocos2dx/particle_nodes/CCParticleSystem.h)、[Quad 子类](src/cocos2dx/particle_nodes/CCParticleSystemQuad.h) 及对应 `.cpp`、[程序入口](src/main.cpp)。

## 简化范围

保留固定粒子数组、逐粒初始化、活动区更新和末尾交换移除；速度/重力用确定值。文件字典与 TextureCache 仍是固定样例，quad 顶点更新和 OpenGL 绘制留到下一课。

## 运行

~~~sh
c++ -std=c++11 -Wall -Wextra -pedantic -Isrc src/main.cpp src/cocos2dx/particle_nodes/CCParticleSystem.cpp src/cocos2dx/particle_nodes/CCParticleSystemQuad.cpp -o /tmp/cocos2d-1x-s48
/tmp/cocos2d-1x-s48
~~~
