# 第 44 课：RigidBody2D 与 Collider2D 怎样进入后端

**本课问题：** Creator 3.8 的刚体和盒形碰撞器怎样经由后端选择器成为 Box2D body 与 fixture？

## 观察结果

`RigidBody2D` 在组件生命周期中创建后端实现，启用时把 body 加入物理世界。`Collider2D` 通过 selector 创建 box shape，在同节点查找刚体并由 Box2D shape 生成 fixture。碰撞器的 density、friction、restitution 随 fixture 提交。

## 源码位置

- [RigidBody2D.onLoad 创建后端实现](../../engine/3.8.7engine/cocos/physics-2d/framework/components/rigid-body-2d.ts#L542)；[刚体类型枚举](../../engine/3.8.7engine/cocos/physics-2d/framework/physics-types.ts#L28)。
- [Box2D 刚体初始化并在启用时加入物理世界](../../engine/3.8.7engine/cocos/physics-2d/box2d/rigid-body.ts#L69)；[PhysicsWorld.addBody 按 Node 世界坐标创建 Box2D body](../../engine/3.8.7engine/cocos/physics-2d/box2d/physics-world.ts#L268)。
- [Collider2D 通过 selector 创建 shape 并查找同节点刚体](../../engine/3.8.7engine/cocos/physics-2d/framework/components/colliders/collider-2d.ts#L158)；[Collider2D.apply 转发修改](../../engine/3.8.7engine/cocos/physics-2d/framework/components/colliders/collider-2d.ts#L195)。
- [BoxCollider2D 的尺寸](../../engine/3.8.7engine/cocos/physics-2d/framework/components/colliders/box-collider-2d.ts#L36)；[Box shape 尺寸换算](../../engine/3.8.7engine/cocos/physics-2d/box2d/shapes/box-shape-2d.ts#L58)；[同节点 body 与 fixture 材质](../../engine/3.8.7engine/cocos/physics-2d/box2d/shapes/shape-2d.ts#L150)。
- [PhysicsSystem2D 步进前同步 Node 到物理世界，步进后同步回 Node](../../engine/3.8.7engine/cocos/physics-2d/framework/physics-system.ts#L278)。

独立代码：[Node](src/cocos/Node.ts)、[PhysicsSystem2D](src/cocos/physics-2d/framework/physics-system.ts)、[selector](src/cocos/physics-2d/framework/physics-selector.ts)、[RigidBody2D](src/cocos/physics-2d/framework/components/rigid-body-2d.ts)、[Collider2D](src/cocos/physics-2d/framework/components/colliders/collider-2d.ts)、[Box2D body/shape 后端](src/cocos/physics-2d/box2d/) 和 [浏览器入口](src/main.ts)。

## 简化范围

示例固定选择 Box2D，后端对象只记录 body、shape 和 fixture，不执行模拟。源码 selector 可按配置选择不同物理后端；此课只展示组件到 Box2D 的接线。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000，观察 selector、PhysicsWorld、RigidBody2D 和 Collider2D 的创建顺序。
