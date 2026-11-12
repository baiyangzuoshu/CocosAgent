# 第 66 课：Creator 2.4.15 刚体生命周期与节点同步

**本课问题：** 刚体何时加入物理世界，模拟结果如何回写节点变换？

## 本版路径

Physics3DManager → RigidBodyComponent.onEnable → CannonRigidBody → 节点回写。

## 源码位置

- [`rigid-body-component.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/physics/framework/components/rigid-body-component.ts>)：核对 Physics3DManager → RigidBodyComponent.onEnable → CannonRigidBody → 节点回写。
- [`cannon-rigid-body.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/physics/cannon/cannon-rigid-body.ts>)：核对 Physics3DManager → RigidBodyComponent.onEnable → CannonRigidBody → 节点回写。
- [`cannon-world.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/physics/cannon/cannon-world.ts>)：核对 Physics3DManager → RigidBodyComponent.onEnable → CannonRigidBody → 节点回写。

前置课程：[第 55 课](<../s55_physics3d_world_step/README.md>)。

## 独立代码与简化

独立代码：[课程实现](<src/cocos2d/core/3d/physics/framework/PhysicsStudy.ts>）。浏览器示例按职责模拟本版流程，不加载 Cannon 或 Builtin 物理后端。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000`。页面会显示：组件激活时加入世界；一步模拟后将后端位置同步回节点，停用时移除刚体。
