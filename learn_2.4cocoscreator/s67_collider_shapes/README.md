# 第 67 课：Creator 2.4.15 碰撞体形状与物理材质

**本课问题：** 节点上的形状、缩放和材质如何变成物理形状？

## 本版路径

ColliderComponent → BoxColliderComponent → CannonBoxShape；缩放换算由形状层完成。

## 源码位置

- [`collider-component.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/physics/framework/components/collider/collider-component.ts>)：核对 ColliderComponent → BoxColliderComponent → CannonBoxShape；缩放换算由形状层完成。
- [`box-collider-component.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/physics/framework/components/collider/box-collider-component.ts>)：核对 ColliderComponent → BoxColliderComponent → CannonBoxShape；缩放换算由形状层完成。
- [`cannon-box-shape.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/physics/cannon/shapes/cannon-box-shape.ts>)：核对 ColliderComponent → BoxColliderComponent → CannonBoxShape；缩放换算由形状层完成。
- [`physics-material.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/physics/framework/assets/physics-material.ts>)：核对 ColliderComponent → BoxColliderComponent → CannonBoxShape；缩放换算由形状层完成。

前置课程：[第 66 课](<../s66_rigidbody_sync/README.md>)。

## 独立代码与简化

独立代码：[课程实现](<src/cocos2d/core/3d/physics/framework/PhysicsStudy.ts>）。浏览器示例按职责模拟本版流程，不加载 Cannon 或 Builtin 物理后端。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000`。页面会显示：先按节点缩放计算 box 半尺寸，再创建形状并保存材质摩擦系数。
