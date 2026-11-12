# 第 70 课：Creator 3.8.7 约束接口与后端能力边界

**本课问题：** 本版本如何表示约束；没有引擎级约束时边界在哪里？

## 本版路径

Constraint component 建立后端 constraint，onEnable/onDisable 控制加入与移除。

## 源码位置

- [`constraint.ts`](<../../engine/3.8.7engine/cocos/physics/framework/components/constraints/constraint.ts>)：核对 Constraint component 建立后端 constraint，onEnable/onDisable 控制加入与移除。
- [`hinge-constraint.ts`](<../../engine/3.8.7engine/cocos/physics/framework/components/constraints/hinge-constraint.ts>)：核对 Constraint component 建立后端 constraint，onEnable/onDisable 控制加入与移除。
- [`physics-system.ts`](<../../engine/3.8.7engine/cocos/physics/framework/physics-system.ts>)：核对 Constraint component 建立后端 constraint，onEnable/onDisable 控制加入与移除。

前置课程：[第 69 课](<../s69_physics_queries/README.md>)。

## 独立代码与简化

独立代码：[课程实现](<src/cocos/physics/framework/PhysicsStudy.ts>）。浏览器示例保留系统、组件和后端边界，不创建真实 Bullet/Cannon 物理世界。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000`。页面会显示：在支持约束的版本里把 hinge 约束加入世界并停用时移除；Creator 2.4 输出源码边界，不造出不存在的约束组件。
