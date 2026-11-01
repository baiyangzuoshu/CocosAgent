# 第 3 课：Director 与帧调度

**目标：** 看清浏览器帧调度怎样经由 Pacer 进入 Game 更新回调，再调用 Director.tick。

## 本课增量

`Game.init()` 在 Infrastructure 阶段创建 Pacer，在 Subsystem 阶段初始化 Director。`game.run()` 启动 Pacer；每次浏览器回调都进入 Game 的更新回调，再把 deltaTime 交给 Director。

~~~text
game.init()
  → Infrastructure: 创建 Pacer
  → Subsystem: director.init()
  → Project: 标记初始化完成
game.run()
  → Pacer.start()
  → Game._updateCallback()
  → director.tick(deltaTime)
~~~

## 源码对照

- `engine/3.8.7engine/cocos/game/game.ts:809`、`engine/3.8.7engine/cocos/game/game.ts:1090-1095`：初始化并连接 Pacer 回调。
- `engine/3.8.7engine/cocos/game/game.ts:1031-1039`：`run()` 在初始化完成后恢复游戏。
- `engine/3.8.7engine/cocos/game/game.ts:1045-1087`：计算 deltaTime 并将更新交给 Director。
- `engine/3.8.7engine/cocos/game/director.ts:767-809`、`engine/3.8.7engine/cocos/game/director.ts:849-865`：`tick()` 与 Director 初始化。
- `engine/3.8.7engine/pal/pacer/pacer-web.ts:86-103`、`engine/3.8.7engine/pal/pacer/pacer-web.ts:113-140`：启动帧调度并选择浏览器 requestAnimationFrame。

## 观察结果

页面显示 Director 已初始化、累计帧数和最近一次 deltaTime；帧数持续增加。

## 简化

Pacer 只保留 Web `requestAnimationFrame` 路径；省略帧率限制、旧浏览器兼容、XR 和定时器回退。Director 不运行组件调度和渲染。首场景、SplashScreen 和项目资源加载尚未加入。

## 运行

在本课目录运行：

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，观察帧数持续增加。
