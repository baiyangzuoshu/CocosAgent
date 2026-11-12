# 第 68 课：Creator 3.8.7 接触事件与碰撞过滤

**本课问题：** 接触或触发如何变成组件事件，过滤条件在哪一层生效？

## 本版路径

Collider.on/onCollisionEnter/onTriggerEnter 注册监听，PhysicsSystem 派发后端结果。

## 源码位置

- [`collider.ts`](<../../engine/3.8.7engine/cocos/physics/framework/components/colliders/collider.ts>)：核对 Collider.on/onCollisionEnter/onTriggerEnter 注册监听，PhysicsSystem 派发后端结果。
- [`physics-system.ts`](<../../engine/3.8.7engine/cocos/physics/framework/physics-system.ts>)：核对 Collider.on/onCollisionEnter/onTriggerEnter 注册监听，PhysicsSystem 派发后端结果。
- [`bullet-world.ts`](<../../engine/3.8.7engine/cocos/physics/bullet/bullet-world.ts>)：核对 Collider.on/onCollisionEnter/onTriggerEnter 注册监听，PhysicsSystem 派发后端结果。

前置课程：[第 67 课](<../s67_collider_shapes/README.md>)。

## 独立代码与简化

独立代码：[课程实现](<src/cocos/physics/framework/PhysicsStudy.ts>）。浏览器示例保留系统、组件和后端边界，不创建真实 Bullet/Cannon 物理世界。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000`。页面会显示：用 group/mask 过滤一对碰撞体，再按 trigger 标志选择 trigger-enter 或 collision-enter。
