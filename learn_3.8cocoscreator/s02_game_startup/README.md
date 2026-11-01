# 第 2 课：分阶段启动

**目标：** 看清 `game.init()` 怎样用 Promise 链依次初始化引擎阶段，以及 `game.run()` 为什么要等初始化完成。

## 本课增量

Game 继承 EventTarget。`init()` 顺序经过 Base、Infrastructure、Subsystem、Project；Subsystem 中初始化 Director。最后设置 `_inited` 并发出 `GAME_INITED`。页面监听阶段事件，再调用 `run()`。

~~~text
game.init(config)
  → Base
  → Infrastructure
  → Subsystem → director.init() → ENGINE_INITED
  → Project → _inited = true → GAME_INITED
  → game.run(onStart)
~~~

## 源码对照

- `engine/3.8.7engine/cocos/game/game.ts:230-289`：启动阶段事件。
- `engine/3.8.7engine/cocos/game/game.ts:734-915`：`init()` 的顺序 Promise 链。
- `engine/3.8.7engine/cocos/game/game.ts:1031-1039`：只有初始化完成后 `run()` 才继续启动。
- `engine/3.8.7engine/cocos/game/director.ts:849-865`：Subsystem 阶段初始化 Director。
- `engine/3.8.7engine/cocos/core/event/event-target.ts:26-46`：Game 和 Director 使用的事件基类。

## 观察结果

页面按顺序显示初始化阶段、引擎初始化事件、游戏初始化事件和 `onStart`。

## 简化

保留 Promise 链和阶段顺序；各阶段只发事件，不初始化真实 `sys`、settings、图形设备、资源管理器和项目脚本。EventTarget 只实现 `on`、`emit`，用 Map 保存监听器。帧调度放在下一课。

## 运行

在本课目录运行：

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>。
