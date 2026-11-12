# 第 67 课：Creator 3.8.7 碰撞体形状与物理材质

**本课问题：** 节点上的形状、缩放和材质如何变成物理形状？

## 本版路径

Collider → BoxCollider → backend shape；活动 shape 从 Collider 生命周期进入 World。

## 源码位置

- [`collider.ts`](<../../engine/3.8.7engine/cocos/physics/framework/components/colliders/collider.ts>)：核对 Collider → BoxCollider → backend shape；活动 shape 从 Collider 生命周期进入 World。
- [`box-collider.ts`](<../../engine/3.8.7engine/cocos/physics/framework/components/colliders/box-collider.ts>)：核对 Collider → BoxCollider → backend shape；活动 shape 从 Collider 生命周期进入 World。
- [`cannon-box-shape.ts`](<../../engine/3.8.7engine/cocos/physics/cannon/shapes/cannon-box-shape.ts>)：核对 Collider → BoxCollider → backend shape；活动 shape 从 Collider 生命周期进入 World。

前置课程：[第 66 课](<../s66_rigidbody_sync/README.md>)。

## 独立代码与简化

独立代码：[课程实现](<src/cocos/physics/framework/PhysicsStudy.ts>）。浏览器示例保留系统、组件和后端边界，不创建真实 Bullet/Cannon 物理世界。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000`。页面会显示：先按节点缩放计算 box 半尺寸，再创建形状并保存材质摩擦系数。
