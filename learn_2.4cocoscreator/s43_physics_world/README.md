# 第 43 课：启用物理世界与帧步进

**本课问题：** Creator 2.4 的物理世界由谁创建，又在一帧的哪个位置推进？

## 观察结果

点击“启用物理”后才创建 Box2D 世界。每次推进 0.04 秒，固定步长 1/60 秒会调用两次 Step。日志顺序为组件 update、Director Scheduler（其中包含 PhysicsManager）、组件 lateUpdate、渲染。

## 源码位置

- [CCDirector 创建 PhysicsManager 并排入系统 Scheduler](../../engine/2.4.15engine/cocos2d/core/CCDirector.js#L200)。
- [PhysicsManager 默认固定步长和累积器选项](../../engine/2.4.15engine/cocos2d/core/physics/CCPhysicsManager.js#L99)；[update 累积 dt 并调用 Box2D Step](../../engine/2.4.15engine/cocos2d/core/physics/CCPhysicsManager.js#L169)。
- [enabled 首次设为 true 时创建 Box2D World](../../engine/2.4.15engine/cocos2d/core/physics/CCPhysicsManager.js#L540)。
- [Director 帧内的组件、Scheduler、lateUpdate 与渲染顺序](../../engine/2.4.15engine/cocos2d/core/CCDirector.js#L845)。

独立代码：[浏览器入口](src/main.ts)、[Director](src/cocos2d/core/CCDirector.ts)、[Scheduler](src/cocos2d/core/CCScheduler.ts)、[PhysicsManager](src/cocos2d/core/physics/CCPhysicsManager.ts) 和 [Box2D 步进替身](src/box2d/b2-world.ts)。

## 简化范围

Box2D 替身只记录 Step 调用，不模拟刚体或碰撞。示例保留 Manager 的延迟建世界、累积时间和固定步进，以及它接入 Director Scheduler 的位置。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000，启用物理后推进一帧，观察每帧步进次数和更新顺序。
