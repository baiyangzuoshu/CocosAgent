# 第 68 课：Creator 2.4.15 接触事件与碰撞过滤

**本课问题：** 接触或触发如何变成组件事件，过滤条件在哪一层生效？

## 本版路径

ColliderComponent.on 注册 collision/trigger 回调；后端事件回到组件事件入口。

## 源码位置

- [`collider-component.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/physics/framework/components/collider/collider-component.ts>)：核对 ColliderComponent.on 注册 collision/trigger 回调；后端事件回到组件事件入口。
- [`physics-interface.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/physics/framework/physics-interface.ts>)：核对 ColliderComponent.on 注册 collision/trigger 回调；后端事件回到组件事件入口。
- [`cannon-world.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/physics/cannon/cannon-world.ts>)：核对 ColliderComponent.on 注册 collision/trigger 回调；后端事件回到组件事件入口。

前置课程：[第 67 课](<../s67_collider_shapes/README.md>)。

## 独立代码与简化

独立代码：[课程实现](<src/cocos2d/core/3d/physics/framework/PhysicsStudy.ts>）。浏览器示例按职责模拟本版流程，不加载 Cannon 或 Builtin 物理后端。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000`。页面会显示：用 group/mask 过滤一对碰撞体，再按 trigger 标志选择 trigger-enter 或 collision-enter。
