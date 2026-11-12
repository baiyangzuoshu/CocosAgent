# 第 77 课：Cocos2d-x 3.x 粒子模拟与生命周期

**本课问题：** 粒子如何逐帧更新并到期回收？

## 本版路径

ParticleSystem3D.update 调 emitter/affector 更新活动粒子。

## 源码位置

- [`CCParticleSystem3D.cpp`](<../../engine/cocos2d-x-3/extensions/Particle3D/CCParticleSystem3D.cpp>)：ParticleSystem3D.update 调 emitter/affector 更新活动粒子。
- [`CCParticle3DAffector.h`](<../../engine/cocos2d-x-3/extensions/Particle3D/CCParticle3DAffector.h>)：ParticleSystem3D.update 调 emitter/affector 更新活动粒子。

前置课程：[第 49 课：粒子绘制与结束](<../s49_particle_render_finish/README.md>)。

## 独立代码与简化

[`src/extensions/Particle3D/ParticleStudy.h`](<src/extensions/Particle3D/ParticleStudy.h>)、[`src/extensions/Particle3D/ParticleStudy.cpp`](<src/extensions/Particle3D/ParticleStudy.cpp>) 与 [`src/main.cpp`](<src/main.cpp>)。独立 C++ 示例模拟 ParticleSystem3D 的 emitter、affector 和 render 职责，不连接真实粒子后端。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/extensions/Particle3D/ParticleStudy.cpp -o /tmp/cocos2d-3x-s77
/tmp/cocos2d-3x-s77
~~~

输出展示活动粒子数量、位置或渲染顶点数。
