# 第 70 课：Creator 2.4.15 约束接口与后端能力边界

**本课问题：** 本版本如何表示约束；没有引擎级约束时边界在哪里？

## 本版路径

PhysicsSelector 选择 Builtin/Cannon；2.4 framework 没有引擎级 3D Constraint component。

## 源码位置

- [`physics-selector.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/physics/framework/physics-selector.ts>)：核对 PhysicsSelector 选择 Builtin/Cannon；2.4 framework 没有引擎级 3D Constraint component。
- [`physics-interface.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/physics/framework/physics-interface.ts>)：核对 PhysicsSelector 选择 Builtin/Cannon；2.4 framework 没有引擎级 3D Constraint component。
- [`physics-manager.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/physics/framework/physics-manager.ts>)：核对 PhysicsSelector 选择 Builtin/Cannon；2.4 framework 没有引擎级 3D Constraint component。

前置课程：[第 69 课](<../s69_physics_queries/README.md>)。

## 独立代码与简化

独立代码：[课程实现](<src/cocos2d/core/3d/physics/framework/PhysicsStudy.ts>). 本地快照没有 3D Constraint 组件；示例只列出 Physics3DManager 的后端选择和已存在接口，明确记录该功能边界。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000`。页面会显示：在支持约束的版本里把 hinge 约束加入世界并停用时移除；Creator 2.4 输出源码边界，不造出不存在的约束组件。
