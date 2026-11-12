# 第 80 课：Cocos2d-x 4.0 停止发射与资源回收

**本课问题：** 停止发射后如何处理存活粒子和资源？

## 本版路径

ParticleSystem3D 状态区分 STOP/RUNNING/PAUSE，结束发射后逐步排空。

## 源码位置

- [`CCParticleSystem3D.h`](<../../engine/cocos2d-x-4/extensions/Particle3D/CCParticleSystem3D.h>)：ParticleSystem3D 状态区分 STOP/RUNNING/PAUSE，结束发射后逐步排空。
- [`CCParticleSystem3D.cpp`](<../../engine/cocos2d-x-4/extensions/Particle3D/CCParticleSystem3D.cpp>)：ParticleSystem3D 状态区分 STOP/RUNNING/PAUSE，结束发射后逐步排空。

前置课程：[第 49 课：粒子绘制与结束](<../s49_particle_render_finish/README.md>)。

## 独立代码与简化

[`src/extensions/Particle3D/ParticleStudy.h`](<src/extensions/Particle3D/ParticleStudy.h>)、[`src/extensions/Particle3D/ParticleStudy.cpp`](<src/extensions/Particle3D/ParticleStudy.cpp>) 与 [`src/main.cpp`](<src/main.cpp>)。独立 C++ 示例模拟 ParticleSystem3D 的 emitter、affector 和 render 职责，不连接真实粒子后端。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/extensions/Particle3D/ParticleStudy.cpp -o /tmp/cocos2d-4x-s80
/tmp/cocos2d-4x-s80
~~~

输出展示活动粒子数量、位置或渲染顶点数。
