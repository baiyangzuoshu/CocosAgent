# 第 79 课：Cocos2d-x 4.0 粒子渲染与批次

**本课问题：** 活动粒子如何变成各版本自己的绘制数据？

## 本版路径

Particle3DRender 接收 ParticleSystem3D 的活动粒子并绘制。

## 源码位置

- [`CCParticle3DRender.h`](<../../engine/cocos2d-x-4/extensions/Particle3D/CCParticle3DRender.h>)：Particle3DRender 接收 ParticleSystem3D 的活动粒子并绘制。
- [`CCParticle3DRender.cpp`](<../../engine/cocos2d-x-4/extensions/Particle3D/CCParticle3DRender.cpp>)：Particle3DRender 接收 ParticleSystem3D 的活动粒子并绘制。
- [`CCParticleSystem3D.cpp`](<../../engine/cocos2d-x-4/extensions/Particle3D/CCParticleSystem3D.cpp>)：Particle3DRender 接收 ParticleSystem3D 的活动粒子并绘制。

前置课程：[第 49 课：粒子绘制与结束](<../s49_particle_render_finish/README.md>)。

## 独立代码与简化

[`src/extensions/Particle3D/ParticleStudy.h`](<src/extensions/Particle3D/ParticleStudy.h>)、[`src/extensions/Particle3D/ParticleStudy.cpp`](<src/extensions/Particle3D/ParticleStudy.cpp>) 与 [`src/main.cpp`](<src/main.cpp>)。独立 C++ 示例模拟 ParticleSystem3D 的 emitter、affector 和 render 职责，不连接真实粒子后端。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/extensions/Particle3D/ParticleStudy.cpp -o /tmp/cocos2d-4x-s79
/tmp/cocos2d-4x-s79
~~~

输出展示活动粒子数量、位置或渲染顶点数。
