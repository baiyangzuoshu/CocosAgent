# 第 55 课：3D 物理世界与帧步进

**本课问题：** 3.8 的 3D 物理为何在组件更新之后，以固定小步推进？

## 观察结果

Creator 3.8 在 Director 初始化事件中创建并注册 `PhysicsSystem`。Director 每帧先更新组件，再调用系统的 `postUpdate`。物理系统把帧间隔加入累积器，每达到 `fixedTimeStep` 就推进一次 World；最多执行 `maxSubSteps` 次，避免单帧物理计算无限追赶。

## 源码位置

- [PhysicsSystem 创建默认 World 并注册到 Director](../../engine/3.8.7engine/cocos/physics/framework/physics-system.ts#L888)。
- [Director 的 update、lateUpdate 与 postUpdate 顺序](../../engine/3.8.7engine/cocos/game/director.ts#L780)。
- [PhysicsSystem 累积帧时间并执行固定子步](../../engine/3.8.7engine/cocos/physics/framework/physics-system.ts#L352)。
- [物理后端选择器构造默认 World](../../engine/3.8.7engine/cocos/physics/framework/physics-selector.ts#L184)。
- [BulletWorld 执行后端步进](../../engine/3.8.7engine/cocos/physics/bullet/bullet-world.ts#L195)。
- 前置课：[第 46 课：物理查询与调试绘制](../s46_physics_queries/README.md)。

独立代码沿 `Director → PhysicsSystem → PhysicsWorld` 分层；BulletWorld 只记录同步、步进和事件调用顺序，不加载 Bullet 后端。

## 简化范围

本课是 Creator 3.8 源码静态映射和独立 TypeScript 示例；未进行 Creator 编辑器、Web 发布包或运行时验收。刚体、碰撞体和后端求解留到后续课程。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

页面用两段帧间隔观察：不足一个固定步时只同步场景；累积时间足够时最多推进两个子步。
