# 第 43 课：PhysicsSystem2D 的帧步进

**本课问题：** Creator 3.8 怎样把 2D 物理接入 Director，并把场景变换同步到物理世界？

## 观察结果

Director 先运行组件 update、lateUpdate 和 AFTER_UPDATE，再调用系统 postUpdate。PhysicsSystem2D 在 postUpdate 中同步场景、按固定 1/60 秒推进，并将结果同步回场景。示例每次推进 0.04 秒，但 maxSubSteps=1，因此每帧最多调用一次 step。

## 源码位置

- [Director 的 update、lateUpdate、AFTER_UPDATE 与系统 postUpdate 顺序](../../engine/3.8.7engine/cocos/game/director.ts#L775)。
- [PhysicsSystem2D 默认步长、最大子步数与自动模拟](../../engine/3.8.7engine/cocos/physics-2d/framework/physics-system.ts#L215)。
- [PhysicsSystem2D.postUpdate 的场景同步、累积器和步进](../../engine/3.8.7engine/cocos/physics-2d/framework/physics-system.ts#L274)。
- [物理系统注册到 Director](../../engine/3.8.7engine/cocos/physics-2d/framework/physics-system.ts#L381)；[具体 PhysicsWorld 由 selector 创建](../../engine/3.8.7engine/cocos/physics-2d/framework/physics-system.ts#L258)。

独立代码：[浏览器入口](src/main.ts)、[Director](src/cocos/game/director.ts)、[PhysicsSystem2D](src/cocos/physics-2d/framework/physics-system.ts)、[PhysicsSelector](src/cocos/physics-2d/framework/physics-selector.ts) 和 [PhysicsWorld 后端替身](src/cocos/physics-2d/box2d/physics-world.ts)。

## 简化范围

后端替身只打印同步和 step，不运行真实刚体。Creator 3.8 可由 selector 选择不同 2D 物理后端；本例只保留框架系统与后端接口。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000，连续推进几帧，观察 postUpdate 的步数上限和同步顺序。
