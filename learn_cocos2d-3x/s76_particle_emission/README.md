# 第 76 课：Cocos2d-x 3.x 粒子系统配置与发射器

**本课问题：** 配置和发射形状如何创建粒子？

## 本版路径

ParticleSystem3D 将粒子配额交给 Particle3DEmitter 发射。

## 源码位置

- [`CCParticleSystem3D.h`](<../../engine/cocos2d-x-3/extensions/Particle3D/CCParticleSystem3D.h>)：ParticleSystem3D 将粒子配额交给 Particle3DEmitter 发射。
- [`CCParticleSystem3D.cpp`](<../../engine/cocos2d-x-3/extensions/Particle3D/CCParticleSystem3D.cpp>)：ParticleSystem3D 将粒子配额交给 Particle3DEmitter 发射。
- [`CCParticle3DEmitter.h`](<../../engine/cocos2d-x-3/extensions/Particle3D/CCParticle3DEmitter.h>)：ParticleSystem3D 将粒子配额交给 Particle3DEmitter 发射。

前置课程：[第 49 课：粒子绘制与结束](<../s49_particle_render_finish/README.md>)。

## 独立代码与简化

[`src/extensions/Particle3D/ParticleStudy.h`](<src/extensions/Particle3D/ParticleStudy.h>)、[`src/extensions/Particle3D/ParticleStudy.cpp`](<src/extensions/Particle3D/ParticleStudy.cpp>) 与 [`src/main.cpp`](<src/main.cpp>)。独立 C++ 示例模拟 ParticleSystem3D 的 emitter、affector 和 render 职责，不连接真实粒子后端。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/extensions/Particle3D/ParticleStudy.cpp -o /tmp/cocos2d-3x-s76
/tmp/cocos2d-3x-s76
~~~

输出展示活动粒子数量、位置或渲染顶点数。
