# 第 46 课：物理查询与调试绘制

**本课问题：** Creator 3.8 的 PhysicsSystem2D 怎样把射线、区域查询和调试绘制交给所选后端？

## 观察结果

`PhysicsSystem2D.raycast` 和 `testAABB` 是框架入口，调用当前 `PhysicsWorld`。射线可指定 Closest/Any/All 和类别 mask。`debugDrawFlags` 转发到后端；Box2D 后端在 Canvas 下创建 `Graphics`，每次 `drawDebug` 清屏后调用 `DrawDebugData`。

## 源码位置

- [raycast、testPoint 与 testAABB 框架接口](../../engine/3.8.7engine/cocos/physics-2d/framework/physics-system.ts#L362)；[ERaycast2DType](../../engine/3.8.7engine/cocos/physics-2d/framework/physics-types.ts#L95)。
- [Box2D PhysicsWorld 中 testPoint/testAABB 查询](../../engine/3.8.7engine/cocos/physics-2d/box2d/physics-world.ts#L359)；[debugDrawFlags 创建 Graphics/PhysicsDebugDraw](../../engine/3.8.7engine/cocos/physics-2d/box2d/physics-world.ts#L109)；[绘制前清空 Graphics 并调用 Box2D](../../engine/3.8.7engine/cocos/physics-2d/box2d/physics-world.ts#L405)。
- [PhysicsSystem2D 在 postUpdate 驱动调试绘制](../../engine/3.8.7engine/cocos/physics-2d/framework/physics-system.ts#L308)。

独立代码：[PhysicsSystem2D](src/cocos/physics-2d/framework/physics-system.ts)、[查询类型与数据](src/cocos/physics-2d/framework/physics-types.ts)、[Box2DPhysicsWorld](src/cocos/physics-2d/box2d/physics-world.ts)、[查询回调](src/cocos/physics-2d/box2d/physics-query-callback.ts)、[绘制器](src/cocos/physics-2d/box2d/physics-debug-draw.ts) 和 [浏览器入口](src/main.ts)。

## 简化范围

浏览器示例固定 Box2D，使用预设命中比例和矩形代替真实后端计算；`Graphics` 以日志表示。样例保留系统到后端的转发、射线类别筛选和 postUpdate 绘制入口。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000，观察 mask 如何筛选射线结果，以及调试旗标如何触发绘制。
