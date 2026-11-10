# 第 45 课：碰撞分组、接触回调与响应

**本课问题：** Creator 3.8 如何通过碰撞矩阵筛选接触，并把 Box2D 事件送到 Collider 脚本？

## 观察结果

`Collider2D.group` 默认沿用同节点 `RigidBody2D.group`，自定义分组则覆盖刚体分组。Box2D shape 用分组位生成 category/mask；启用 `enabledContactListener` 后 fixture 才进入报告列表。PhysicsWorld 收到 Begin/Pre/Post 回调后由 PhysicsContact.emit 派发；`disabledOnce` 跳过当前步的求解。

## 源码位置

- [默认组和分组值](../../engine/3.8.7engine/cocos/physics-2d/framework/physics-types.ts#L81)；[Collider2D 的组属性与变更转发](../../engine/3.8.7engine/cocos/physics-2d/framework/components/colliders/collider-2d.ts#L58)；[shape 从碰撞矩阵生成 filter](../../engine/3.8.7engine/cocos/physics-2d/box2d/shapes/shape-2d.ts#L37)。
- [PhysicsWorld 设置 Box2D 接触回调](../../engine/3.8.7engine/cocos/physics-2d/box2d/physics-world.ts#L72)；[启用监听的刚体登记 fixture](../../engine/3.8.7engine/cocos/physics-2d/box2d/shapes/shape-2d.ts#L185)。
- [PhysicsWorld 转发接触阶段](../../engine/3.8.7engine/cocos/physics-2d/box2d/physics-world.ts#L416)；[PhysicsContact.emit 派发到 Collider 和 PhysicsSystem2D](../../engine/3.8.7engine/cocos/physics-2d/box2d/physics-contact.ts#L214)；[单步禁用接触](../../engine/3.8.7engine/cocos/physics-2d/box2d/physics-contact.ts#L233)。

独立代码：[PhysicsSystem2D](src/cocos/physics-2d/framework/physics-system.ts)、[RigidBody2D](src/cocos/physics-2d/framework/rigid-body-2d.ts)、[Collider2D](src/cocos/physics-2d/framework/collider-2d.ts)、[Box2D shape filter](src/cocos/physics-2d/box2d/shapes/shape-2d.ts)、[PhysicsWorld 与 Contact](src/cocos/physics-2d/box2d/) 和 [浏览器入口](src/main.ts)。

## 简化范围

浏览器样例固定 Box2D，只模拟过滤、fixture 监听登记和事件派发，不运行物理后端或形状检测。Creator 的其他后端由 selector 选择，本课不覆盖。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000，观察矩阵过滤、按需注册以及 PreSolve 对本步响应的影响。
