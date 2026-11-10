# 第 43 课：Scene 拥有并自动推进 PhysicsWorld

**本课问题：** Cocos2d-x 4.x 的物理世界怎样创建，并在帧循环中自动步进？

## 观察结果

Scene::createWithPhysics 创建并持有 PhysicsWorld。Director 先更新 Scheduler，再调用当前 Scene 的 stepPhysicsAndNavigation，随后渲染。示例显式设置 60Hz 固定更新率；推进 0.04 秒会产生两次物理步进。

## 源码位置

- [Scene::createWithPhysics/initWithPhysics 创建世界](../../engine/cocos2d-x-4/cocos/2d/CCScene.cpp#L287)；[Scene 按 autoStep 转发 update](../../engine/cocos2d-x-4/cocos/2d/CCScene.cpp#L331)。
- [Director 在 Scheduler 更新后、绘制前步进 Scene 物理世界](../../engine/cocos2d-x-4/cocos/base/CCDirector.cpp#L261)。
- [PhysicsWorld::update 的固定频率累积与子步进](../../engine/cocos2d-x-4/cocos/physics/CCPhysicsWorld.cpp#L877)；[固定更新率入口](../../engine/cocos2d-x-4/cocos/physics/CCPhysicsWorld.h#L296)。
- PhysicsWorld 的实现使用 Chipmunk，见 [CCPhysicsWorld.cpp](../../engine/cocos2d-x-4/cocos/physics/CCPhysicsWorld.cpp#L26)。

独立代码：[Director](src/cocos/base/CCDirector.cpp)、[Scene](src/cocos/2d/CCScene.cpp) 和 [PhysicsWorld](src/cocos/physics/CCPhysicsWorld.cpp)。

## 简化范围

本地物理后端只记录模拟步数；没有创建真实刚体或调用 Chipmunk。示例假定 CC_USE_PHYSICS 已启用，保留 Scene 所有权、Director 更新顺序、默认开启的自动步进与固定频率累积。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/base/CCDirector.cpp src/cocos/2d/CCScene.cpp src/cocos/physics/CCPhysicsWorld.cpp -o /tmp/cocos2d-4x-s43
/tmp/cocos2d-4x-s43
~~~
