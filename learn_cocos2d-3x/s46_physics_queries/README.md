# 第 46 课：PhysicsWorld 查询与调试绘制

**本课问题：** Cocos2d-x 3.x 如何通过 PhysicsWorld 查询 Chipmunk 形状并显示调试图？

## 观察结果

`PhysicsWorld::rayCast` 把每个命中交给回调，回调返回 `true` 继续、`false` 停止；`queryRect` 用矩形边界查找重叠形状。非零 debug draw mask 会让 World 在更新时创建/刷新 DrawNode，并由 Chipmunk 绘制形状和接触数据。

## 源码位置

- [PhysicsWorld 查询接口与回调签名](../../engine/cocos2d-x-3/cocos/physics/CCPhysicsWorld.h#L56)；[RayCast 与 queryRect 调用 Chipmunk 查询](../../engine/cocos2d-x-3/cocos/physics/CCPhysicsWorld.cpp#L398)。
- [debugDraw 创建 DrawNode 并调用 cpSpaceDebugDraw](../../engine/cocos2d-x-3/cocos/physics/CCPhysicsWorld.cpp#L268)；[非零 mask 时由 World 更新驱动绘制](../../engine/cocos2d-x-3/cocos/physics/CCPhysicsWorld.cpp#L952)；[setDebugDrawMask](../../engine/cocos2d-x-3/cocos/physics/CCPhysicsWorld.cpp#L818)。

独立代码按职责拆分：[PhysicsShape 与矩形](src/cocos/physics/CCPhysicsShape.h)、[PhysicsWorld 接口](src/cocos/physics/CCPhysicsWorld.h)、[查询和调试绘制实现](src/cocos/physics/CCPhysicsWorld.cpp) 与 [入口](src/main.cpp)。

## 简化范围

样例遍历预设 shape 和命中比例，替代 Chipmunk 的空间索引；DrawNode/Chipmunk 绘图输出为日志。保留回调继续/停止语义、矩形重叠和 debug mask 驱动顺序。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/physics/CCPhysicsWorld.cpp -o /tmp/cocos2d-3x-s46
/tmp/cocos2d-3x-s46
~~~
