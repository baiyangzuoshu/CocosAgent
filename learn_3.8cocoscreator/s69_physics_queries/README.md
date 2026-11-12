# 第 69 课：Creator 3.8.7 射线与物理查询

**本课问题：** 射线查询怎样返回最近命中及其所属物理对象？

## 本版路径

PhysicsSystem.raycastClosest → IPhysicsWorld → 后端 → PhysicsRayResult。

## 源码位置

- [`physics-system.ts`](<../../engine/3.8.7engine/cocos/physics/framework/physics-system.ts>)：核对 PhysicsSystem.raycastClosest → IPhysicsWorld → 后端 → PhysicsRayResult。
- [`physics-ray-result.ts`](<../../engine/3.8.7engine/cocos/physics/framework/physics-ray-result.ts>)：核对 PhysicsSystem.raycastClosest → IPhysicsWorld → 后端 → PhysicsRayResult。
- [`bullet-world.ts`](<../../engine/3.8.7engine/cocos/physics/bullet/bullet-world.ts>)：核对 PhysicsSystem.raycastClosest → IPhysicsWorld → 后端 → PhysicsRayResult。

前置课程：[第 68 课](<../s68_contact_filter/README.md>)。

## 独立代码与简化

独立代码：[课程实现](<src/cocos/physics/framework/PhysicsStudy.ts>）。浏览器示例保留系统、组件和后端边界，不创建真实 Bullet/Cannon 物理世界。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000`。页面会显示：对候选物体做简化射线求交，按距离选择最近结果，并携带对象、位置和法线。
