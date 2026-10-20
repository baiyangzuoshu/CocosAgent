# 2.4.15：引擎装配、启动与帧循环

启动到首帧的可视化路径见[阶段 1 流程图](../diagrams/01-startup-and-frame.md)。

## 范围与证据状态

本篇分析本工作区 `2.4.15engine/` 的运行时路径，以 `2.4.15NewProject/` 核对场景身份。已在 Creator 2.4.15 浏览器预览中观察到 Hello World 场景，并读取 `localhost:7456` 实际返回的页面、`settings.js` 与 `app/editor/static/preview-templates/boot.js`。还通过临时本机代理插入探针，在 Chrome 图形预览中测得初始化、场景和首帧事件顺序；[原始记录](../agent-foundation/traces/2.4.15-preview-startup.jsonl)保留 `performance.now()` 时间戳。代理没有改动工程或引擎源码。已核对本工作区与已安装 Creator 所附带的 `index.js`、`CCGame.js`、`CCDirector.js` 文件哈希一致。这里测量的是编辑器**浏览器预览**，不是构建产物或原生平台。

## 2.4 官网手册校准

| 手册声明 | 本地证据与校准结论 |
| --- | --- |
| [项目结构](https://docs.cocos.com/creator/2.4/manual/zh/getting-started/project-structure.html)：`assets/` 保存资源与脚本，根目录 `project.json` 与 `assets/` 标识项目，`settings/` 保存项目设置；`library/`、`local/`、`temp/` 属于生成或本机数据。 | 示例具有这些目录及根目录 `project.json`。`settings/project.json` 中的 `start-scene` 是场景 UUID，与根目录的项目身份文件作用不同；原文中的场景 UUID 核对仍成立。 |
| [预览和构建](https://docs.cocos.com/creator/2.4/manual/zh/getting-started/basics/preview-build.html)：编辑器可选浏览器或模拟器预览；预览当前已打开的场景；预览与构建发布是不同操作。 | 本次仅在 Chrome 浏览器预览中观察 `helloworld.fire`。手册支持按“当前打开场景”理解该行为；`settings.js`、`boot.js` 和事件毫秒数是这次预览的宿主与实测证据，手册不规定其内部接线。 |
| [加载和切换场景](https://docs.cocos.com/creator/2.4/manual/zh/scripting/scene-managing.html)：开发者可用 `cc.director.loadScene(name)`；Bundle 的 `loadScene` 只加载资源，仍需运行场景。 | 下文所述 `director.loadScene` 是公开用法的实现入口；本次预览宿主加载 `preview-scene.json` 后调用 `runSceneImmediate`。两条路径针对不同调用者，不构成手册与源码冲突。 |

2.4 手册没有描述 `EVENT_ENGINE_INITED`、`EVENT_GAME_INITED` 到首帧的精确事件顺序，也没有规定浏览器预览 `boot.js` 的调用细节。下文相关结论均来自 2.4.15 源码和本次探针记录，不能解释为官网保证的跨平台时序。

## 模块装配：让引擎 API 可用

`gulpfile.js:188-204` 说明预览版和 JSB 版引擎都以 `index.js` 为构建入口。入口先创建全局 `cc`，加载环境宏与 polyfill，再引入 `cocos2d/core/predefine`、`cocos2d` 和 `extends`（`index.js:40-76`）。`cocos2d/core/predefine.js:27-45` 在这里预先装配平台、事件、资源、`CCDirector` 等模块；`cocos2d/index.js:26-29` 引入 `CCGame` 和动作模块。`extends.js:27-48` 再引入核心、动画、粒子等扩展。编辑器主进程有条件分支，因此这条路径不能不加区分地当作编辑器内全部执行过程。

这里的 `cc` 是全局命名空间；`cc.game` 由 `CCGame.js:884-897` 挂载，`cc.director` 由 `CCDirector.js:1120-1128` 创建。**模块加载**只建立对象与注册回调，尚未等于**游戏已启动**。

## 运行时启动链

```text
预览 boot.js 在插件与内建/main bundle 就绪后调用 cc.game.run(option, onStart)
  → _initConfig(config)
  → prepare()
  → _loadPreviewScript()：预览模式可先加载项目脚本
  → _prepareFinished()
      → _initEngine()：初始化渲染器和系统事件，发 EVENT_ENGINE_INITED
      → _setAnimFrame()：选定帧请求方式
      → cc.assetManager.builtins.init(...)
      → _prepared = true，_runMainLoop()
      → 发 EVENT_GAME_INITED
      → onStart()
```

证据分别在 `CCGame.js:364-400`、`:472-495`、`:564-650`。`_initEngine()` 发出 `EVENT_ENGINE_INITED` 时，预先注册的 `cc.Director` 监听器会调用 `director.init()`（`CCDirector.js:139-165`）；`sharedInit()` 建立组件调度器、节点激活器以及已装配的引擎系统（`:173-221`）。因此不能把 `EVENT_GAME_INITED` 当作创建 director 的时点：director 对象更早存在，初始化则由引擎事件触发。

渲染初始化在 `CCGame.js:719-804`：确定画布和容器、选择可用渲染类型、初始化 WebGL 或 Canvas 后端。系统输入与显隐事件在 `:806-880` 注册。帧请求由 `:564-600` 按平台和目标帧率选择；普通运行时的 `_runMainLoop()` 在 `:625-651` 中调度下一次回调，然后调用 `director.mainLoop(now)`。编辑器模式直接返回，不走这条自驱动循环（`:625-629`）。

## 从一次回调到绘制

非编辑器分支的 `CCDirector.mainLoop()` 位于 `CCDirector.js:870-913`：

1. 计算帧间隔 `dt`。
2. 未暂停时依次触发更新前事件、组件 `start`、组件 `update`、引擎 `Scheduler`、组件 `lateUpdate`、更新后事件，并延迟销毁对象。
3. 发绘制前事件，调用 `renderer.render(this._scene, dt)`，随后发绘制后事件并更新帧监听器。

`cocos2d/core/renderer/index.js:175-181` 表明渲染器在存在场景时把场景交给 `RenderFlow`。这只能证明帧循环到渲染入口；更深的 draw call 路径留给渲染专题。

场景不是由 `cc.game.run()` 直接指定。常规 `cc.director.loadScene(name)` 在 `CCDirector.js:525-555` 中查找包含该场景的 bundle、加载资源并调用 `runSceneImmediate()`。本次**预览**的实际接线不同：页面先加载 `settings.js`、快速编译脚本、`boot.js` 和预览引擎；`boot.js` 等插件及内建/main bundle 加载完成后调用 `cc.game.run(option, onStart)`。`onStart` 暂停游戏，加载 `preview-scene.json`，再把其中的 `SceneAsset.scene` 传给 `runSceneImmediate(scene, onBeforeLoadScene)`，回调里恢复游戏。`settings.js` 的 `launchScene` 是 `db://assets/Scene/helloworld.fire`；实际返回的 `preview-scene.json` 中场景 `_id` 是 `2d2f792f-a40c-49bb-a189-ed176a246e49`，与工程 `settings/project.json:11` 和 `helloworld.fire.meta:3` 的场景身份一致。预览页直接加载 `preview-scene.json`，因此不能把 `settings.js` 的路径误读为这次调用了 `director.loadScene(name)`。

## 预览实测事件顺序

以下数字来自同一次 Chrome 图形预览，单位为导航后的毫秒；仅用于确认先后关系，不代表固定耗时。

| 时间 | 探针位置 |
| ---: | --- |
| 229.2 / 229.8 | 调用 `game.run` / `game.run` 返回；准备工作继续异步执行。 |
| 253.8 / 295.5 | 监听到 `EVENT_ENGINE_INITED` / `EVENT_GAME_INITED`。 |
| 295.6 / 305.6 | 进入 `onStart` / `preview-scene.json` 加载完成。 |
| 305.7 / 305.7 / 305.9 / 313.3 | 调用 `runSceneImmediate` / 其第二参数回调执行 / `EVENT_BEFORE_SCENE_LAUNCH` / `EVENT_AFTER_SCENE_LAUNCH`。 |
| 313.8 / 314.0 / 315.0 | 首次 `director.mainLoop` / `EVENT_BEFORE_UPDATE` / `EVENT_AFTER_UPDATE`。 |
| 315.1 / 317.3 | 首次 `EVENT_BEFORE_DRAW` / `EVENT_AFTER_DRAW`。 |

`runSceneImmediate` 的第二参数名为 `onBeforeLoadScene`（`CCDirector.js:422-474`），所以探针记录的“callback”位于场景启动事件之前；它不是场景已经启动的通知。事件探针通过 `once` 监听，记录的是回调执行点；同一事件上的其他监听器可能先于该探针执行。

## 对后续研究有用的边界

- `_runMainLoop()` 在 `EVENT_GAME_INITED` 和 `onStart` 前安排帧请求；不能仅凭 `game.run()` 推断首个渲染回调已具有活动场景。本次预览实测首个 `director.mainLoop` 发生在场景启动后，但这不是所有资源加载耗时下的通用保证。
- `game.pause()` 停止帧请求；`director.pause()` 仅影响逻辑更新，绘制仍在 director 的主循环中（`CCGame.js:276-321`、`CCDirector.js:881-908`）。
- 构建入口、运行时入口、游戏启动入口是三个不同位置：`gulpfile.js`、`index.js`、`CCGame.run()`。调试“没有首帧”时应先判断中断发生在哪一段。

## 后续范围

构建后的 Web 宿主、原生宿主和更深的渲染提交路径仍需分别研究；本文的时序结论仅适用于这次 2.4.15 编辑器预览运行。
