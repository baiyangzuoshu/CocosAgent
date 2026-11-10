# 第 44 课：RigidBody 与 Collider 怎样挂到 Node

**本课问题：** 节点上的刚体类型、盒形和材质如何进入 Box2D？

## 观察结果

`RigidBody` 从所属 Node 读取世界位置并创建 Box2D body。`PhysicsBoxCollider` 在同一 Node 查找刚体，把盒形生成 `PolygonShape`，再把 density、friction、restitution 写入 fixture。静态地面和动态方块共享这条接线。

## 源码位置

- [BodyType 与默认 Dynamic](../../engine/2.4.15engine/cocos2d/core/physics/CCPhysicsTypes.js#L39)、[RigidBody 的默认类型](../../engine/2.4.15engine/cocos2d/core/physics/CCRigidBody.js#L54)。
- [RigidBody.__init 生成 BodyDef 并读取 Node 世界坐标](../../engine/2.4.15engine/cocos2d/core/physics/CCRigidBody.js#L882)；[交给 PhysicsManager](../../engine/2.4.15engine/cocos2d/core/physics/CCRigidBody.js#L909)；[PhysicsManager 调用 Box2D World.CreateBody](../../engine/2.4.15engine/cocos2d/core/physics/CCPhysicsManager.js#L370)。
- [Collider 查找同节点 RigidBody 并创建 fixture](../../engine/2.4.15engine/cocos2d/core/physics/collider/CCPhysicsCollider.js#L160)；[密度、摩擦、弹性与 FixtureDef](../../engine/2.4.15engine/cocos2d/core/physics/collider/CCPhysicsCollider.js#L193)。
- [BoxCollider 尺寸换算并生成 PolygonShape](../../engine/2.4.15engine/cocos2d/core/physics/collider/CCPhysicsBoxCollider.js#L45)；[物理结果同步到 Node 的入口](../../engine/2.4.15engine/cocos2d/core/physics/CCRigidBody.js#L767)。

独立代码：[Node](src/cocos2d/core/CCNode.ts)、[BodyType](src/cocos2d/core/physics/CCPhysicsTypes.ts)、[PhysicsManager](src/cocos2d/core/physics/CCPhysicsManager.ts)、[RigidBody](src/cocos2d/core/physics/CCRigidBody.ts)、[Collider 基类](src/cocos2d/core/physics/collider/CCPhysicsCollider.ts)、[盒形子类](src/cocos2d/core/physics/collider/CCPhysicsBoxCollider.ts) 和 [Box2D 替身](src/box2d/b2-world.ts)。

## 简化范围

替身只打印 body 与 fixture 的创建，不运行重力或碰撞。它保留 Creator 2.4 的职责拆分和同节点查找关系；盒形尺寸与材质按示例值写死。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000，观察 `ground` 与 `crate` 各自的 body type，以及 Collider 如何把形状和材质交给 body。
