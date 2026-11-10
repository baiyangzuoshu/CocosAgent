# 第 46 课：物理查询与调试绘制

**本课问题：** 如何从 PhysicsManager 查询碰撞体，并查看物理形状的调试图？

## 观察结果

`rayCast` 通过 Box2D 回调收集射线命中，默认只保留最近结果；`testAABB` 走 AABB 查询回调，筛出动态刚体的候选碰撞体。`debugDrawFlags` 打开后，Manager 创建 `Graphics` 绘制器，并在物理步进后清屏、调用 `DrawDebugData`。

## 源码位置

- [PhysicsManager.testAABB](../../engine/2.4.15engine/cocos2d/core/physics/CCPhysicsManager.js#L259)、[rayCast 与 RayCastType](../../engine/2.4.15engine/cocos2d/core/physics/CCPhysicsManager.js#L289)；[回调控制最近/任意/全部命中](../../engine/2.4.15engine/cocos2d/core/physics/platform/CCPhysicsRayCastCallback.js#L43)。
- [AABB 回调筛选动态刚体，并对点查询执行 TestPoint](../../engine/2.4.15engine/cocos2d/core/physics/platform/CCPhysicsAABBQueryCallback.js#L47)。
- [PhysicsManager 创建绘制器](../../engine/2.4.15engine/cocos2d/core/physics/CCPhysicsManager.js#L518)；[每步调用 DrawDebugData](../../engine/2.4.15engine/cocos2d/core/physics/CCPhysicsManager.js#L201)；[PhysicsDebugDraw 将形状写入 Graphics](../../engine/2.4.15engine/cocos2d/core/physics/platform/CCPhysicsDebugDraw.js#L33)。

独立代码：[PhysicsManager](src/cocos2d/core/physics/CCPhysicsManager.ts)、[RayCastType 与查询数据](src/cocos2d/core/physics/CCPhysicsTypes.ts)、[射线回调](src/cocos2d/core/physics/platform/CCPhysicsRayCastCallback.ts)、[AABB 回调](src/cocos2d/core/physics/platform/CCPhysicsAABBQueryCallback.ts)、[调试绘制器](src/cocos2d/core/physics/platform/CCPhysicsDebugDraw.ts)、[Box2D 替身](src/box2d/b2-world.ts) 和 [浏览器入口](src/main.ts)。

## 简化范围

浏览器样例用预设命中比例和矩形代替 Box2D 几何计算，`Graphics` 绘制以日志表示。保留 Manager 到查询回调、World 和调试绘制器的调用关系；`testAABB` 仍只返回动态刚体候选。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000，比较 Closest/All、矩形查询结果和调试绘制调用。
