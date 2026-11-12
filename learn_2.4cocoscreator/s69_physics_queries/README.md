# 第 69 课：Creator 2.4.15 射线与物理查询

**本课问题：** 射线查询怎样返回最近命中及其所属物理对象？

## 本版路径

Physics3DManager.raycastClosest → IPhysicsWorld → CannonWorld → PhysicsRayResult。

## 源码位置

- [`physics-manager.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/physics/framework/physics-manager.ts>)：核对 Physics3DManager.raycastClosest → IPhysicsWorld → CannonWorld → PhysicsRayResult。
- [`physics-ray-result.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/physics/framework/physics-ray-result.ts>)：核对 Physics3DManager.raycastClosest → IPhysicsWorld → CannonWorld → PhysicsRayResult。
- [`cannon-world.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/physics/cannon/cannon-world.ts>)：核对 Physics3DManager.raycastClosest → IPhysicsWorld → CannonWorld → PhysicsRayResult。

前置课程：[第 68 课](<../s68_contact_filter/README.md>)。

## 独立代码与简化

独立代码：[课程实现](<src/cocos2d/core/3d/physics/framework/PhysicsStudy.ts>）。浏览器示例按职责模拟本版流程，不加载 Cannon 或 Builtin 物理后端。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000`。页面会显示：对候选物体做简化射线求交，按距离选择最近结果，并携带对象、位置和法线。
