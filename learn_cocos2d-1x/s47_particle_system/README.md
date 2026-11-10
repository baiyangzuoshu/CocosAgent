# 第 47 课：粒子系统创建与配置

**本课问题：** 1.x 如何从 plist 配置创建粒子系统，并为 Quad 粒子准备数据？

## 观察结果

`CCParticleSystemQuad::particleWithFile` 进入基础系统的文件/字典解析。`initWithTotalParticles` 先分配粒子数组，Quad 子类再分配四边形与索引数组；贴图由基础配置交给 Quad 的 `setTexture`。

## 源码位置

- [Quad 工厂 `particleWithFile`](../../engine/cocos2d-x-1/cocos2dx/particle_nodes/CCParticleSystemQuad.cpp#L95)；[基类文件加载和字典解析](../../engine/cocos2d-x-1/cocos2dx/particle_nodes/CCParticleSystem.cpp#L144)、[`initWithDictionary`](../../engine/cocos2d-x-1/cocos2dx/particle_nodes/CCParticleSystem.cpp#L157)。
- [固定容量粒子数组](../../engine/cocos2d-x-1/cocos2dx/particle_nodes/CCParticleSystem.cpp#L330)；[Quad 初始化粒子、quad 和 index 数据](../../engine/cocos2d-x-1/cocos2dx/particle_nodes/CCParticleSystemQuad.cpp#L38)；[纹理矩形接线](../../engine/cocos2d-x-1/cocos2dx/particle_nodes/CCParticleSystemQuad.cpp#L158)。

独立代码：[基础粒子系统](src/cocos2dx/particle_nodes/CCParticleSystem.h)、[Quad 子类](src/cocos2dx/particle_nodes/CCParticleSystemQuad.h) 及对应 `.cpp`、[程序入口](src/main.cpp)。

## 简化范围

文件字典和 TextureCache 用固定样例代替；`std::vector` 表示源码的 `new[]` 数组，`unique_ptr/shared_ptr` 替代 autorelease/retain。保留基类、Quad 虚函数初始化和数据容量关系，省略 OpenGL 上传与粒子更新。

## 运行

~~~sh
c++ -std=c++11 -Wall -Wextra -pedantic -Isrc src/main.cpp src/cocos2dx/particle_nodes/CCParticleSystem.cpp src/cocos2dx/particle_nodes/CCParticleSystemQuad.cpp -o /tmp/cocos2d-1x-s47
/tmp/cocos2d-1x-s47
~~~
