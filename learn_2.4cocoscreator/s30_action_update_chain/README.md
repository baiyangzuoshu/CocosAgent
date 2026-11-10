# 第 30 课：动作更新链

**目标：** 跟踪 Tween 启动后，动作如何进入 ActionManager、经过 Scheduler 逐帧执行，并在完成后移除。

## 本课递进

点击“启动动作”后，三步探针按下面的链条运行：

**Tween.start → ActionManager.addAction → Director.mainLoop → Scheduler.update → ActionManager.update → Action.step**

页面只显示调用顺序和管理器中的动作数量；本课不讲属性插值。第 31 课再看时间进度如何改变节点属性。

## 源码位置

- 引擎 [Tween.start](../../engine/2.4.15engine/cocos2d/actions/tween.js#L274) 建立最终动作，并在 [加入 ActionManager](../../engine/2.4.15engine/cocos2d/actions/tween.js#L281)。
- 引擎 [CCActionManager.addAction](../../engine/2.4.15engine/cocos2d/actions/CCActionManager.js#L119) 保存目标和动作，再调用 startWithTarget；[update](../../engine/2.4.15engine/cocos2d/actions/CCActionManager.js#L468) 调用 step、检查完成状态并移除。
- 引擎 [CCDirector 初始化 ActionManager 并注册到 Scheduler](../../engine/2.4.15engine/cocos2d/core/CCDirector.js#L156)；[主循环更新 Scheduler](../../engine/2.4.15engine/cocos2d/core/CCDirector.js#L891)。
- 引擎 [CCScheduler.update](../../engine/2.4.15engine/cocos2d/core/CCScheduler.js#L403) 遍历已注册的更新对象。
- 另一条入口是 [CCNode.runAction](../../engine/2.4.15engine/cocos2d/core/CCNode.js#L2507)，它也把动作交给同一个 ActionManager；该接口在 2.4.15 会触发弃用警告。

## 代码与运行

代码入口：[main.ts](src/main.ts)、[tween.ts](src/cocos2d/actions/tween.ts)、[CCActionManager.ts](src/cocos2d/actions/CCActionManager.ts)、[CCScheduler.ts](src/cocos2d/core/CCScheduler.ts)、[CCDirector.ts](src/cocos2d/core/CCDirector.ts)。

为了集中看更新链，代码把 Tween 的属性动作构造压缩成一个三步探针；ActionManager 的保存、启动、逐帧推进和完成移除仍按源码职责拆开。实现省略目标分组哈希、暂停标记、动作并发修改保护和 Tween 属性构造。

构建要求 Node 22.13+。在本目录运行：

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，点击“启动动作”。
