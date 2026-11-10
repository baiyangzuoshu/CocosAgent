# 第 47 课：粒子系统创建与配置

**本课问题：** 3.x 怎样从配置建立 ParticleData，并由 Quad 子类准备绘制数据？

## 观察结果

`ParticleSystemQuad::create` 走 `initWithFile` 和 ValueMap 配置解析。基类按 `maxParticles` 初始化 ParticleData 的分离数组并加载贴图；Quad 子类额外分配 quad/index 数组。活动数量仍为零。

## 源码位置

- [`ParticleSystemQuad::create`](../../engine/cocos2d-x-3/cocos/2d/CCParticleSystemQuad.cpp#L74)；[`ParticleSystem::initWithFile` / `initWithDictionary`](../../engine/cocos2d-x-3/cocos/2d/CCParticleSystem.cpp#L286)；[`maxParticles` 进入容量初始化](../../engine/cocos2d-x-3/cocos/2d/CCParticleSystem.cpp#L314)。
- [ParticleData 分离数组](../../engine/cocos2d-x-3/cocos/2d/CCParticleSystem.h#L54)；[基类按容量分配 ParticleData](../../engine/cocos2d-x-3/cocos/2d/CCParticleSystem.cpp#L554)。
- [Quad 子类初始化](../../engine/cocos2d-x-3/cocos/2d/CCParticleSystemQuad.cpp#L111)；[纹理矩形接线](../../engine/cocos2d-x-3/cocos/2d/CCParticleSystemQuad.cpp#L221)；[quad 和 index 内存](../../engine/cocos2d-x-3/cocos/2d/CCParticleSystemQuad.cpp#L625)。

独立代码：[ParticleSystem](src/cocos/2d/CCParticleSystem.h)、[ParticleSystemQuad](src/cocos/2d/CCParticleSystemQuad.h) 及对应 `.cpp`、[程序入口](src/main.cpp)。

## 简化范围

ValueMap、FileUtils、TextureCache 和 GPU 内存以本地替身表示；`std::vector` 替代源码的 `malloc` 数组，`unique_ptr/shared_ptr` 替代 autorelease/retain。ParticleData 只保留位置和寿命字段，quad/index 只观察容量。不发射粒子，也不提交渲染命令。

## 运行

~~~sh
c++ -std=c++11 -Wall -Wextra -pedantic -Isrc src/main.cpp src/cocos/2d/CCParticleSystem.cpp src/cocos/2d/CCParticleSystemQuad.cpp -o /tmp/cocos2d-3x-s47
/tmp/cocos2d-3x-s47
~~~
