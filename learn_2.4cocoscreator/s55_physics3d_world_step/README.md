# 第 55 课：3D 物理世界与帧步进

**本课问题：** Director 怎样把一帧交给 3D 物理世界？

## 观察结果

Creator 2.4 的 Director 在构建包含 Builtin 或 Cannon 物理模块时创建 `Physics3DManager`，并把它排入系统调度。管理器默认关闭；启用后默认以 `1/60` 秒调用一次 World，再发出物理结束事件。本例只保留这条默认固定步进路径。

Cannon World 自己负责把场景状态同步到物理对象、推进 Cannon，再把结果同步回场景并派发事件。

## 源码位置

- [CCDirector.sharedInit 创建并调度 Physics3DManager](../../engine/2.4.15engine/cocos2d/core/CCDirector.js#L209)。
- [Physics3DManager 构造 World 与 update 步进分支](../../engine/2.4.15engine/cocos2d/core/3d/physics/framework/physics-manager.ts#L192)、[默认固定步进](../../engine/2.4.15engine/cocos2d/core/3d/physics/framework/physics-manager.ts#L215)。
- [后端选择结果创建 PhysicsWorld](../../engine/2.4.15engine/cocos2d/core/3d/physics/framework/instance.ts#L26)。
- [CannonWorld 同步、步进和派发事件](../../engine/2.4.15engine/cocos2d/core/3d/physics/cannon/cannon-world.ts#L101)。
- 前置课：[第 46 课：物理查询与调试绘制](../s46_physics_queries/README.md)。

独立代码按 `CCDirector → Physics3DManager → PhysicsWorld` 分层；`CannonWorld` 只打印调用顺序，不包含 Cannon 库。

## 简化范围

课程示例选择 Cannon 工厂并模拟默认固定步进，不实现 Builtin/Cannon 后端选择宏、刚体、碰撞体或物理求解。真实 2.4 构建中可用后端由构建宏决定，管理器也可能不存在。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

页面显示每帧是否启用物理、固定步长及 World 调用顺序。
