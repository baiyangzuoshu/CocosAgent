# 相同行为对照：启动场景并进入首帧

两版独立路径和同一行为的分叉见[阶段 1 流程图](../diagrams/01-startup-and-frame.md)。

对照目标是“宿主启动游戏，加载首个场景，执行一次逻辑更新与绘制”。先阅读 [2.x 独立分析](../2.x/01-startup-and-frame.md) 与 [3.x 独立分析](../3.x/01-startup-and-frame.md)。两代示例的编辑器浏览器预览均已成功显示各自场景，且已取得[2.x](../agent-foundation/traces/2.4.15-preview-startup.jsonl)与[3.x](../agent-foundation/traces/3.8.7-preview-startup.jsonl)的启动事件记录。下面区分引擎源码、构建模板和实际预览宿主。

## 官网行为基线

[2.4 项目结构](https://docs.cocos.com/creator/2.4/manual/zh/getting-started/project-structure.html)以根目录 `project.json` 与 `assets/` 标识项目；[3.8 项目结构](https://docs.cocos.com/creator/3.8/manual/zh/getting-started/project-structure/index.html)改以根目录 `package.json` 与 `assets/` 标识项目。各自的 `settings/` 与生成目录职责也要按版本理解。

[2.4 预览手册](https://docs.cocos.com/creator/2.4/manual/zh/getting-started/basics/preview-build.html)说明浏览器或模拟器预览当前打开场景；[3.8 预览手册](https://docs.cocos.com/creator/3.8/manual/zh/editor/preview/index.html)还允许在编辑器内预览，并提供场景选择，默认“当前场景”。两次打点都是**浏览器预览当前场景**，不能推广到 3.8 的其他场景选择，也不能推广到模拟器、构建产物或原生发布。

两版[2.4](https://docs.cocos.com/creator/2.4/manual/zh/scripting/scene-managing.html)与[3.8](https://docs.cocos.com/creator/3.8/manual/zh/scripting/scene-managing.html)脚本手册都以各自版本的 `director.loadScene` 说明公开场景切换用法；以下对照中的 `runSceneImmediate` 是本次预览宿主的内部接线。3.8 [预览流程文档](https://docs.cocos.com/creator/3.8/manual/zh/editor/preview/preview-guid.html)说明预览服务及配置生成，但没有规定下表中的四阶段初始化与事件时序。精确顺序仅由源码和运行记录支持。

| 观察点 | 2.4.15 | 3.8.7 |
| --- | --- | --- |
| 项目身份 | 根目录 `project.json` 与 `assets/`；`settings/project.json` 另存 `start-scene` 等项目设置。 | 根目录 `package.json` 与 `assets/`；示例另有 `profiles/`、`settings/`。 |
| 编辑器可选预览 | 浏览器或模拟器；本次 Chrome 浏览器预览当前场景。 | 编辑器内、浏览器或模拟器，且可选择场景；本次 Chrome 浏览器预览当前场景。 |
| 引擎模块入口 | `index.js` 建立全局 `cc`，经 `require` 装配模块；Gulp 以此构建预览与 JSB 包。 | `exports/base.ts` 提供基础模块导出；Web 模板通过 `System.import('cc')` 加载构建后的引擎。 |
| 宿主启动 API | 实际预览 `boot.js` 在资源包就绪后调用 `cc.game.run(option, onStart)`；`run` 内继续异步准备。 | Web 构建模板依次调用 `game.init(config)` 和 `game.run()`；实际预览由 `/preview-app/main.js` 调用这两个 API，并在 `game.run` 回调中加载场景。 |
| 初始化组织 | `_initEngine` 初始化渲染与事件、发 `EVENT_ENGINE_INITED`；内建资源准备后安排帧循环、发 `EVENT_GAME_INITED`、调用 `onStart`。 | Base → Infrastructure → Subsystem → Project 的异步链，每阶段有前后委托；`EVENT_ENGINE_INITED` 与 `EVENT_GAME_INITED` 位于不同阶段。 |
| 帧驱动 | `CCGame._runMainLoop` 直接安排帧请求并调用 `director.mainLoop(now)`。 | 平台 `Pacer` 调用 `Game._updateCallback`；启动画面和启动场景处理后，后续回调进入 `director.tick(dt)`。 |
| 每帧逻辑 | `CCDirector.mainLoop` 调用组件调度器、统一 `Scheduler`、延迟销毁。 | `Director.tick` 调用组件调度器、按优先级注册的系统、延迟销毁，并派发输入与帧事件。 |
| 绘制入口 | `renderer.render(scene, dt)`，再由 `RenderFlow` 处理场景。 | `Root.frameMove(dt)` 进入渲染帧流程。 |
| 首场景来源 | 实际预览 `settings.js` 指向 `helloworld.fire`，`boot.js` 加载 `preview-scene.json` 并调用 `runSceneImmediate`。 | 实际预览设置为 `current_scene`；宿主把运行时自动启动场景配置清空，再请求 `scene/current_scene.json` 并调用 `runSceneImmediate`。 |

## 可确认的共同模式与关键差异

两代都有 `game` 负责整体启动和帧驱动，`director` 负责场景与每帧逻辑；场景加载最终都要经过资源 bundle 和场景激活。这个共同模式有源码支撑，但不能据此认为初始化时点、系统调度或渲染入口相同。

最影响排障的差异是 **3.x 显式区分异步 `init()` 与 `run()`，并在帧回调中处理启动画面和启动场景**；2.x 的 `run()` 内部完成准备并安排循环，首场景由宿主的 `onStart` 接线决定。两套实际预览都绕过常规场景名加载入口，显式取得当前场景 JSON 后调用 `runSceneImmediate`。遇到黑屏或首帧不执行，应按当前宿主链路设置断点。

两次预览的实测顺序分别是：

```text
2.x  game.run 返回 → ENGINE_INITED → GAME_INITED → onStart
     → 预览场景加载 → BEFORE_SCENE_LAUNCH → AFTER_SCENE_LAUNCH
     → 首次 mainLoop → BEFORE_UPDATE → AFTER_UPDATE → BEFORE_DRAW → AFTER_DRAW

3.x  PRE/POST BASE → PRE/POST INFRASTRUCTURE → PRE/POST SUBSYSTEM
     → ENGINE_INITED → PRE PROJECT → RENDERER_INITED → POST PROJECT
     → GAME_INITED → game.init 完成 → game.run
     → 预览场景加载 → BEFORE_SCENE_LAUNCH → AFTER_SCENE_LAUNCH
     → 第三次 Pacer 回调 / 首次 tick → BEFORE_UPDATE → AFTER_UPDATE → BEFORE_DRAW → AFTER_DRAW
```

3.x 本次预览的 `RENDERER_INITED` 晚于 `ENGINE_INITED`；这与事件常量注释声称的顺序不一致，但符合 `_setRenderPipeline()` 在 Project 阶段调用的源码路径。2.x 预览中 `runSceneImmediate` 的第二参数回调发生在 `BEFORE_SCENE_LAUNCH` 之前，它是 `onBeforeLoadScene`。

源码证据索引：2.x 的 `index.js:40-76`、`cocos2d/core/CCGame.js:364-400,491-495,625-650`、`cocos2d/core/CCDirector.js:870-913`；3.x 的 `templates/web-desktop/index.js.ejs:8-16`、`templates/launcher/application.ejs:24-36`、`cocos/game/game.ts:734-915,1031-1096`、`cocos/game/director.ts:767-809`。

## 证据边界

以上记录只覆盖两套示例在编辑器浏览器预览中的一次运行。浏览器的毫秒数不能当成引擎保证的时长；构建 Web、原生和小游戏宿主需要各自取证。
