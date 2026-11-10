# 第 30 课：动作更新链

**目标：** 跟踪 Tween 启动后，动作如何进入 ActionManager、经过 TweenSystem 逐帧执行，并在完成后移除。

## 本课递进

点击“启动动作”后，三步探针按下面的链条运行：

**Tween.start → ActionManager.addAction → Director.tick → TweenSystem.update → ActionManager.update → Action.step**

页面只显示调用顺序和管理器中的动作数量；本课不讲属性插值。第 31 课再看时间进度如何改变节点属性。

## 源码位置

- 引擎 [Tween.start](../../engine/3.8.7engine/cocos/tween/tween.ts#L329) 汇总最终动作，并在 [加入 ActionManager](../../engine/3.8.7engine/cocos/tween/tween.ts#L344)。
- 引擎 [ActionManager.update](../../engine/3.8.7engine/cocos/tween/actions/action-manager.ts#L479) 遍历目标动作、调用 step 并移除已完成动作。
- 引擎 [TweenSystem.update](../../engine/3.8.7engine/cocos/tween/tween-system.ts#L76) 每帧更新 ActionManager；[系统初始化时注册到 Director](../../engine/3.8.7engine/cocos/tween/tween-system.ts#L83)。
- 引擎 [Director 更新系统](../../engine/3.8.7engine/cocos/game/director.ts#L774)。

## 代码与运行

代码入口：[main.ts](src/main.ts)、[tween.ts](src/cocos/tween/tween.ts)、[action-manager.ts](src/cocos/tween/actions/action-manager.ts)、[tween-system.ts](src/cocos/tween/tween-system.ts)、[director.ts](src/cocos/game/director.ts)。

为了集中看更新链，代码把 Tween 的属性动作构造压缩成一个三步探针；ActionManager 的保存、启动、逐帧推进和完成移除仍按源码职责拆开。实现省略目标分组哈希、暂停标记、动作并发修改保护和 Tween 属性构造。

构建要求 Node 22.13+。在本目录运行：

~~~
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，点击“启动动作”。
