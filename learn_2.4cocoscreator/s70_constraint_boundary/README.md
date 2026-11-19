# 第 70 课：Creator 2.4.15 约束接口与后端能力边界

**本课问题：** 本版本如何表示约束；没有引擎级约束时边界在哪里？

## 本版路径

PhysicsSelector 选择 Builtin/Cannon；2.4 framework 没有引擎级 3D Constraint component。

## 源码位置

- [`physics-selector.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/physics/framework/physics-selector.ts>)：核对 PhysicsSelector 选择 Builtin/Cannon；2.4 framework 没有引擎级 3D Constraint component。
- [`physics-interface.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/physics/framework/physics-interface.ts>)：核对 PhysicsSelector 选择 Builtin/Cannon；2.4 framework 没有引擎级 3D Constraint component。
- [`physics-manager.ts`](<../../engine/2.4.15engine/cocos2d/core/3d/physics/framework/physics-manager.ts>)：核对 PhysicsSelector 选择 Builtin/Cannon；2.4 framework 没有引擎级 3D Constraint component。

前置课程：[第 69 课](<../s69_physics_queries/README.md>)。

## 本课必须保留的机制

必须保留 Creator 2.4.15 的能力边界：PhysicsSelector 可选择 Builtin/Cannon，但本版 framework 没有引擎级 3D Constraint 组件；不能把其他版本或后端能力说成本版 Runtime API。

## 最小观察宿主

`src/main.ts` 只调用一次 `runLesson()` 并输出能力清单；无需场景、按钮或帧循环。

## 模型化简化与 Creator Runtime 边界

独立代码：[课程实现](<src/cocos2d/core/3d/physics/framework/PhysicsStudy.ts>)。`capabilities` 只是静态能力记录，不模拟约束，也不调用 `Director → Physics3DManager` 或任何物理后端；示例刻意不造出不存在的 Constraint API。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000`。页面会显示：在支持约束的版本里把 hinge 约束加入世界并停用时移除；Creator 2.4 输出源码边界，不造出不存在的约束组件。
