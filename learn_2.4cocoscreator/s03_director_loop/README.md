# 第 3 课：Director 初始化与主循环

**目标：** 看清 Director 如何等待引擎初始化事件，以及浏览器帧回调如何进入 mainLoop。

## 本课增量

Director 构造时用 once 监听 EVENT_ENGINE_INITED。CCGame 发出该事件后调用 Director.init()；准备完成后，CCGame 用 requestAnimationFrame 循环调用 director.mainLoop(now)。

~~~text
CCDirector 构造
  → game.once(EVENT_ENGINE_INITED, director.init, director)

CCGame._prepareFinished
  → _initEngine()
  → EVENT_ENGINE_INITED
  → director.init()
  → _prepared = true
  → _runMainLoop()
  → EVENT_GAME_INITED
  → onStart()

requestAnimationFrame
  → director.mainLoop(now)
~~~

## 源码对照

- src/cocos2d/core/predefine.ts → engine/2.4.15engine/cocos2d/core/predefine.js:33-38：在核心预定义阶段装配 CCDirector。
- src/cocos2d/core/CCDirector.ts → engine/2.4.15engine/cocos2d/core/CCDirector.js:107-145, 147-167, 870-910, 1008, 1126：构造监听、init、Web mainLoop、更新事件和单例注册。
- src/cocos2d/core/CCGame.ts → engine/2.4.15engine/cocos2d/core/CCGame.js:364-376, 387-400, 625-651：发送引擎初始化事件，准备完成后启动帧循环，再通知游戏初始化完成。
- src/cocos2d/core/event/event-target.ts → engine/2.4.15engine/cocos2d/core/event/event-target.js:201-203：once 注册一次性事件监听。

## 本课简化

Director 只保存初始化状态、帧数和 deltaTime；mainLoop 不运行组件调度器或渲染。CCGame 使用浏览器原生 requestAnimationFrame，不处理编辑器分支、30 FPS 降频和暂停恢复。

## 运行

本课是独立工程。在本目录运行：

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，观察帧数持续增加。
