# 第 43 课：应用层驱动 Box2D 世界

**本课问题：** Cocos2d-x 1.x 没有内置 PhysicsWorld 时，Box2D 世界由谁推进？

## 观察结果

Layer 调用 scheduleUpdate 后，Director 的帧循环会让 Scheduler 调用 Layer.update(dt)。应用在这个回调里直接调用 Box2D 的 Step(dt, velocityIterations, positionIterations)。

## 源码位置

- [Director 在绘制前推进 Scheduler](../../engine/cocos2d-x-1/cocos2dx/CCDirector.cpp#L176)；[CCNode::scheduleUpdate 注册每帧回调](../../engine/cocos2d-x-1/cocos2dx/base_nodes/CCNode.cpp#L1026)；[Scheduler 调用目标 update](../../engine/cocos2d-x-1/cocos2dx/CCScheduler.cpp#L641)。
- 仓库随附的第三方 Box2D 声明了 [b2World::Step](../../engine/cocos2d-x-1/Box2D/Dynamics/b2World.h#L89)。在 cocos2dx 核心目录没有内置 PhysicsWorld/PhysicsManager 包装。

独立代码：[main.cpp](src/main.cpp)，其中 DemoBox2DWorld 只记录 Step 调用。

## 简化范围

本代仓库提供 Box2D 库，但没有 Creator 式的物理世界接线。示例只展示应用层 Layer 的所有权和更新位置；DemoBox2DWorld 不是实际 Box2D，也不模拟刚体、重力或碰撞。

## 运行

~~~sh
c++ -std=c++11 src/main.cpp -o /tmp/cocos2d-1x-s43
/tmp/cocos2d-1x-s43
~~~
