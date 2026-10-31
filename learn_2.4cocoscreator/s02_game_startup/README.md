# 第 2 课：游戏启动

**目标：** 看清 cc.game.run() 怎样进入引擎初始化，并按顺序发出启动事件。

## 本课增量

本课保留第 1 课代码，增加 EventTarget、CCGame 和 cocos2d/index.ts。页面显示启动事件顺序：

~~~text
run()
  → _initConfig()
  → prepare()
  → _prepareFinished()
  → _initEngine()
  → EVENT_ENGINE_INITED
  → EVENT_GAME_INITED
  → onStart()
~~~

## 源码对照

- src/index.ts、src/cocos2d/core/predefine.ts → engine/2.4.15engine/index.js:40-76、engine/2.4.15engine/cocos2d/core/predefine.js:27-45：命名空间已就绪后，按顺序装配模块。
- src/cocos2d/index.ts → engine/2.4.15engine/cocos2d/index.js:26：加载 CCGame。
- src/cocos2d/core/CCGame.ts → engine/2.4.15engine/cocos2d/core/CCGame.js:364-400, 491-495, 654-685, 897：配置处理、启动流程、引擎初始化和 cc.game 注册。
- src/cocos2d/core/event/event-target.ts → engine/2.4.15engine/cocos2d/core/event/event-target.js:59-62, 240，以及 engine/2.4.15engine/cocos2d/core/CCGame.js:403-404, 884-885：事件方法定义和混入。

## 本课简化

课程代码同源码一样导出单例 game，并混入 EventTarget 方法。配置只保留 frameRate；prepare() 用微任务表示异步边界；_initEngine() 用标记代替渲染器和系统事件安装，_prepareFinished() 暂时省略内建资源初始化与主循环。EventTarget 用 Map 简化 CallbacksInvoker，只实现 on 和 emit。

## 运行

本课是独立工程。在本目录运行：

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000> 观察启动顺序。
