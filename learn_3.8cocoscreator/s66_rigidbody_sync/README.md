# 第 66 课：Creator 3.8.7 刚体生命周期与节点同步

**本课问题：** 刚体何时加入物理世界，模拟结果如何回写节点变换？

## 本版路径

PhysicsSystem → RigidBody.onLoad/onEnable → 后端 body → Scene transform。

## 源码位置

- [`rigid-body.ts`](<../../engine/3.8.7engine/cocos/physics/framework/components/rigid-body.ts>)：核对 PhysicsSystem → RigidBody.onLoad/onEnable → 后端 body → Scene transform。
- [`physics-system.ts`](<../../engine/3.8.7engine/cocos/physics/framework/physics-system.ts>)：核对 PhysicsSystem → RigidBody.onLoad/onEnable → 后端 body → Scene transform。
- [`bullet-rigid-body.ts`](<../../engine/3.8.7engine/cocos/physics/bullet/bullet-rigid-body.ts>)：核对 PhysicsSystem → RigidBody.onLoad/onEnable → 后端 body → Scene transform。

前置课程：[第 55 课](<../s55_physics3d_world_step/README.md>)。

## 独立代码与简化

独立代码：[课程实现](<src/cocos/physics/framework/PhysicsStudy.ts>）。浏览器示例保留系统、组件和后端边界，不创建真实 Bullet/Cannon 物理世界。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000`。页面会显示：组件激活时加入世界；一步模拟后将后端位置同步回节点，停用时移除刚体。
