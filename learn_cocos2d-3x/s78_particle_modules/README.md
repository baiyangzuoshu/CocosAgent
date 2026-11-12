# 第 78 课：Cocos2d-x 3.x 粒子属性模块与曲线

**本课问题：** 随时间变化的模块如何修改粒子状态？

## 本版路径

Particle3DAffector 子类在粒子更新时修改速度或颜色。

## 源码位置

- [`CCParticle3DAffector.h`](<../../engine/cocos2d-x-3/extensions/Particle3D/CCParticle3DAffector.h>)：Particle3DAffector 子类在粒子更新时修改速度或颜色。
- [`CCPUGravityAffector.cpp`](<../../engine/cocos2d-x-3/extensions/Particle3D/PU/CCPUGravityAffector.cpp>)：Particle3DAffector 子类在粒子更新时修改速度或颜色。
- [`CCPUColorAffector.cpp`](<../../engine/cocos2d-x-3/extensions/Particle3D/PU/CCPUColorAffector.cpp>)：Particle3DAffector 子类在粒子更新时修改速度或颜色。

前置课程：[第 49 课：粒子绘制与结束](<../s49_particle_render_finish/README.md>)。

## 独立代码与简化

[`src/extensions/Particle3D/ParticleStudy.h`](<src/extensions/Particle3D/ParticleStudy.h>)、[`src/extensions/Particle3D/ParticleStudy.cpp`](<src/extensions/Particle3D/ParticleStudy.cpp>) 与 [`src/main.cpp`](<src/main.cpp>)。独立 C++ 示例模拟 ParticleSystem3D 的 emitter、affector 和 render 职责，不连接真实粒子后端。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/extensions/Particle3D/ParticleStudy.cpp -o /tmp/cocos2d-3x-s78
/tmp/cocos2d-3x-s78
~~~

输出展示活动粒子数量、位置或渲染顶点数。
