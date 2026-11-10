# 第 48 课：粒子发射与逐帧模拟

**本课问题：** 3.x 如何批量发射到 ParticleData，再逐帧推进速度和寿命？

## 观察结果

`update` 用累计时间算出本帧发射数，`addParticles` 初始化 ParticleData 分离数组中的新范围。随后批量扣减寿命；活动粒子按速度/重力更新位置，过期项通过末尾复制缩小活动区。

## 源码位置

- [`addParticles` 初始化新数据范围](../../engine/cocos2d-x-3/cocos/2d/CCParticleSystem.cpp#L611)；[`update` 按发射累计批量生成](../../engine/cocos2d-x-3/cocos/2d/CCParticleSystem.cpp#L864)。
- [寿命递减与过期粒子压缩](../../engine/cocos2d-x-3/cocos/2d/CCParticleSystem.cpp#L902)；[重力和速度推进位置](../../engine/cocos2d-x-3/cocos/2d/CCParticleSystem.cpp#L955)。

独立代码：[ParticleData 与 ParticleSystem](src/cocos/2d/CCParticleSystem.h)、[逐帧更新](src/cocos/2d/CCParticleSystem.cpp)、[ParticleSystemQuad](src/cocos/2d/CCParticleSystemQuad.h) 和 [程序入口](src/main.cpp)。

## 简化范围

保留 SoA 分离数组、批量发射、寿命和重力位置更新；只记录位置、方向和寿命，省略颜色/尺寸随机化和 Quad 顶点更新。

## 运行

~~~sh
c++ -std=c++11 -Wall -Wextra -pedantic -Isrc src/main.cpp src/cocos/2d/CCParticleSystem.cpp src/cocos/2d/CCParticleSystemQuad.cpp -o /tmp/cocos2d-3x-s48
/tmp/cocos2d-3x-s48
~~~
