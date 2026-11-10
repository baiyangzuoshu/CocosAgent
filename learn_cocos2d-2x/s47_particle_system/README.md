# 第 47 课：粒子系统创建与配置

**本课问题：** 2.x 如何把 plist 配置转成粒子容量、纹理和 Quad 数据？

## 观察结果

`CCParticleSystemQuad::create` 进入 `initWithFile`，文件字典解析后先调用虚函数 `initWithTotalParticles` 分配粒子数组；Quad 子类再分配 quad/index 数据。贴图路径由 plist 所在目录和 `textureFileName` 组合。

## 源码位置

- [Quad 工厂 `create`](../../engine/cocos2d-x-2/cocos2dx/particle_nodes/CCParticleSystemQuad.cpp#L112)；[基类文件加载与配置解析](../../engine/cocos2d-x-2/cocos2dx/particle_nodes/CCParticleSystem.cpp#L168)、[`initWithDictionary` 取得最大粒子数](../../engine/cocos2d-x-2/cocos2dx/particle_nodes/CCParticleSystem.cpp#L198)。
- [基类粒子数组分配](../../engine/cocos2d-x-2/cocos2dx/particle_nodes/CCParticleSystem.cpp#L392)；[Quad 子类分配与初始化索引](../../engine/cocos2d-x-2/cocos2dx/particle_nodes/CCParticleSystemQuad.cpp#L48)；[纹理与矩形接线](../../engine/cocos2d-x-2/cocos2dx/particle_nodes/CCParticleSystemQuad.cpp#L202)。

独立代码：[基础粒子系统](src/cocos2dx/particle_nodes/CCParticleSystem.h)、[Quad 子类](src/cocos2dx/particle_nodes/CCParticleSystemQuad.h) 及对应 `.cpp`、[程序入口](src/main.cpp)。

## 简化范围

用内存配置和纹理缓存替代 plist/XML 与文件系统；`std::vector` 表示源码的 `calloc` 数组，`unique_ptr/shared_ptr` 替代 autorelease/retain。保留 `create` 入口、相对目录解析、基类容量分配和 Quad 初始化。VBO 只记录容量，不提交 GPU 绘制。

## 运行

~~~sh
c++ -std=c++11 -Wall -Wextra -pedantic -Isrc src/main.cpp src/cocos2dx/particle_nodes/CCParticleSystem.cpp src/cocos2dx/particle_nodes/CCParticleSystemQuad.cpp -o /tmp/cocos2d-2x-s47
/tmp/cocos2d-2x-s47
~~~
