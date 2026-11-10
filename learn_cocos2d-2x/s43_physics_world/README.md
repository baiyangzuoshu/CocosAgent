# 第 43 课：应用层驱动 Box2D 世界

**本课问题：** Cocos2d-x 2.x 怎样把随仓库提供的 Box2D 接入自己的帧更新？

## 观察结果

CCNode 的 scheduleUpdate 把节点交给 Scheduler；Director 在绘制前传入本帧 dt。应用层 PhysicsLayer.update 再把 dt 和求解迭代数传给 Box2D 的 Step。

## 源码位置

- [Director 在绘制前更新 Scheduler](../../engine/cocos2d-x-2/cocos2dx/CCDirector.cpp#L249)；[CCNode::scheduleUpdate](../../engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp#L1056)；[Scheduler 按优先级调用 update](../../engine/cocos2d-x-2/cocos2dx/CCScheduler.cpp#L783)。
- 随仓库提供的第三方 Box2D 定义 [b2World::Step](../../engine/cocos2d-x-2/external/Box2D/Dynamics/b2World.h#L89)。cocos2dx 核心目录没有内置 PhysicsWorld/PhysicsManager 包装。

独立代码：[main.cpp](src/main.cpp)，展示应用层拥有世界并从 Layer.update 调用 Step。

## 简化范围

仓库中的 Box2D 是独立第三方库，不是 Cocos2d-x 2.x 的 Scene 物理子系统。示例中的 DemoBox2DWorld 只打印调用，不链接真实 Box2D，也不模拟刚体、重力或碰撞。

## 运行

~~~sh
c++ -std=c++11 src/main.cpp -o /tmp/cocos2d-2x-s43
/tmp/cocos2d-2x-s43
~~~
