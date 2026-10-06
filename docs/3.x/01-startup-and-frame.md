# 3.8.7：引擎装配、启动与帧循环

启动到首帧的可视化路径见[阶段 1 流程图](../diagrams/01-startup-and-frame.md)。

## 范围与证据状态

本篇追踪 `3.8.7engine/` 的 Web 桌面模板、引擎运行时和 `3.8,7NewProject/` 的编辑器浏览器预览。已读取 `localhost:7457` 实际返回的入口页面、`settings.js`、`preview-app/index.js` 与 `preview-app/main.js`，并通过临时本机代理插入探针，在 Chrome 图形预览中测得初始化、场景和首帧事件顺序；[原始记录](../agent-foundation/traces/3.8.7-preview-startup.jsonl)保留 `performance.now()` 时间戳。代理没有改动工程或引擎源码。`temp/logs/project.log` 属于编辑器 Scene 进程，不等同于浏览器预览。已核对本工作区与已安装 Creator 所附带的 `game.ts`、`director.ts`、`application.ejs` 文件哈希一致。原生和小游戏有各自的模板与 `Pacer` 实现。

## 3.8 官网手册校准

| 手册声明 | 本地证据与校准结论 |
| --- | --- |
| [项目结构](https://docs.cocos.com/creator/3.8/manual/zh/getting-started/project-structure/index.html)：`assets/` 保存资源与脚本，根目录 `package.json` 与 `assets/` 标识项目；`profiles/`、`settings/` 保存编辑器和项目配置，`library/`、`temp/` 等是导入或临时数据。 | 示例具有 `assets/`、`package.json`、`profiles/`、`settings/`、`library/` 和 `temp/`。其 `package.json` 写明 Creator 3.8.7；不能沿用 2.4 的根目录 `project.json` 判断项目身份。 |
| [项目预览调试](https://docs.cocos.com/creator/3.8/manual/zh/editor/preview/index.html)：可选编辑器内、浏览器或模拟器预览；可在预览按钮旁选择场景，默认“当前场景”；预览和构建发布分开。 | 本次选择 Chrome 浏览器及当前场景。`settings.launch.launchScene = "current_scene"` 是该选择在本次预览响应中的表示；其他场景选择和平台不适用下文的具体 URL 与时序。 |
| [预览流程简介](https://docs.cocos.com/creator/3.8/manual/zh/editor/preview/preview-guid.html)：浏览器预览由编辑器提供服务，预览模板加载引擎和初始化场景，项目资源与设置依赖生成的预览配置；手册以 `settings.json` 描述该配置。 | 本次浏览器入口实际请求 `settings.js?scene=current_scene`，并由 `/preview-app/main.js` 提供场景接线。手册描述的是配置生成及排障入口，浏览器响应名和具体宿主调用以本次取证为准；不能仅凭名称差异判定配置语义冲突。`cocos/core/settings.ts:55-126` 也区分配置数据与读取路径。 |
| [加载和切换场景](https://docs.cocos.com/creator/3.8/manual/zh/scripting/scene-managing.html)：公开用法为 `director.loadScene(name)`，Bundle 的 `loadScene` 只加载资源，仍需运行场景。 | 引擎启动分支可调用 `director.loadScene`；本次当前场景预览清空自动启动配置后，宿主显式加载 JSON 并调用 `runSceneImmediate`。这说明预览宿主与公开 API 示例的入口不同，不是手册冲突。 |

3.8 手册没有给出 `Game.init` 四阶段委托、各初始化事件与首帧的精确顺序。下文中的阶段和毫秒数是 3.8.7 源码及本次 Chrome 预览探针的结论。特别是 `EVENT_RENDERER_INITED` 与 `EVENT_ENGINE_INITED` 的顺序，须按具体源码路径和运行环境核对，不能从手册概述推定。

## 模块装配与宿主入口

`exports/base.ts:26-59` 先导入 `predefine` 和兼容层，再导出 `cocos/core`、场景、游戏、资源、输入等基础 API；其他特性还有各自的 `exports/*.ts`。`package.json:14-30` 和 `scripts/build-h5-source.js:15-23` 展示了 npm 构建入口及 `@cocos/ccbuild` 的 HTML5 System 模块构建参数。源码导出、构建结果和项目宿主脚本是三个层次。

Web 桌面**构建模板** `templates/web-desktop/index.js.ejs:2-16` 创建 `Application`，通过 `System.import('cc')` 获取引擎，调用 `application.init(engine)` 与 `application.start()`。`templates/launcher/application.ejs:9-36` 在 `init` 中注册初始化阶段委托，在 `start` 中调用 `cc.game.init({ settingsPath, overrideSettings, ... })`，等待 Promise 完成后调用 `cc.game.run()`。这是构建模板路径，不能直接当作编辑器预览的宿主脚本。

本次**编辑器预览**页面加载 polyfills、SystemJS import maps、引擎 bundle 与 `settings.js?scene=current_scene`，在 `window.onload` 中导入 `/preview-app/index.js` 并调用 `bootstrap(...)`。后者导入 `cc` 和 `/preview-app/main.js`。`main.js` 取 `settings.launch.launchScene` 的原值 `current_scene`，随后在传给 `game.init` 的覆盖配置中把 `launch.launchScene` 清空；`game.run` 的回调再请求 `scene/current_scene.json`，调用 `assetManager.loadWithJson` 和 `director.runSceneImmediate`。因此这次预览的首场景由预览宿主显式加载，不能直接套用构建模板或运行时自动 `director.loadScene` 的分支。

## 分阶段初始化

`Game.init(config)` 在 `cocos/game/game.ts:700-915` 中构成顺序 Promise 链：

| 阶段 | 关键动作 | 可用性边界 |
| --- | --- | --- |
| Base | 初始化日志、`sys`、系统事件与 `settings` | `onPostBaseInitDelegate` 之后可依赖基础配置（`:738-763`）。 |
| Infrastructure | 查找画布、初始化 `screen` 和图形设备、资源管理器、内建资源管理器、Layer 与 `Pacer` | `onPostInfrastructureInitDelegate` 之后可依赖这些设施（`:765-818`）。 |
| Subsystem | 初始化效果配置、脚本包、`director` 与 `Root`，加载内建资源 | 发 `EVENT_ENGINE_INITED`（`:820-870`）；`director.init()` 创建并初始化 `Root`，见 `director.ts:849-865`。 |
| Project | 加载插件 JS、项目 bundle、脚本、渲染管线、预加载资源与启动画面 | 结束时设置 `_inited` 并发 `EVENT_GAME_INITED`（`:872-914`）。 |

阶段前后都有事件和异步委托，`game.ts:477-522` 说明这些委托对应的 API 可用性。`game.run()` 不负责重复初始化：若 `_inited` 尚未为真会直接返回；否则调用 `resume()` 启动 `Pacer`（`game.ts:1031-1039`、`:603-608`）。

## 从 Pacer 到首个场景帧

Web `Pacer` 在 `pal/pacer/pacer-web.ts:86-101` 安排计时回调；根据环境与帧率选择 `requestAnimationFrame` 或定时器（`:113-148`），再调用绑定的 `Game._updateCallback`（`game.ts:1090-1096`）。`_updateCallback` 有三种路径（`game.ts:1062-1088`）：

1. 启动画面尚未结束时，只更新启动画面。
2. 首次进入场景阶段时，从 `settings` 的 `launch.launchScene` 取场景名，调用 `director.loadScene()`；场景加载完成后启动 director 动画并调用 `onStart`。如果没有配置启动场景，直接执行后两步。
3. 后续回调才调用 `director.tick(dt)`。

`Director.loadScene()` 在 `cocos/game/director.ts:525-552` 从 bundle 加载场景并启动；`runSceneImmediate()` 在 `:438-493` 处理旧场景、激活新场景并调用 `startAnimation()`。`Director.tick()` 在 `:767-809` 派发帧事件与输入，依次执行组件及系统更新、延迟销毁、UI 脏数据更新，最后调用 `Root.frameMove(dt)`。`Root.frameMove()` 在 `cocos/root.ts:468-486` 进入渲染帧流程。更深的渲染阶段留给渲染专题。

示例包含 `assets/scene/main.scene`，其 `.meta` UUID 为 `7c3e7fab-7b1e-4865-ba84-3cf81b48b9fb`。浏览器预览返回的设置值是 `launch.launchScene = "current_scene"`；实际返回的 `scene/current_scene.json` 中 `cc.Scene` 名为 `main`，`_id` 与该 `.meta` UUID 相同。此结论只对应当前场景预览；构建产物的设置仍需另行核对。

## 预览实测事件顺序

以下数字来自同一次 Chrome 图形预览，单位为导航后的毫秒；仅用于确认先后关系，不代表固定耗时。

| 时间 | 探针位置 |
| ---: | --- |
| 463.9–478.0 | 调用 `game.init`，`PRE_BASE_INIT` → `POST_BASE_INIT`。 |
| 478.3–497.6 | `PRE_INFRASTRUCTURE_INIT` → `POST_INFRASTRUCTURE_INIT`。 |
| 556.8–750.0 | `PRE_SUBSYSTEM_INIT` → `POST_SUBSYSTEM_INIT`。 |
| 750.2–750.3 | `EVENT_ENGINE_INITED` → `PRE_PROJECT_INIT`。 |
| 768.7–774.9 | `EVENT_RENDERER_INITED` → `POST_PROJECT_INIT` → `EVENT_GAME_INITED`。 |
| 775.1–800.3 | `game.init` Promise 完成、调用 `game.run`；前两次 `_updateCallback` 后进入 `game.run` 回调。 |
| 800.4–1073.6 | 请求预览场景，加载资源，调用 `runSceneImmediate`，触发 `BEFORE_SCENE_LAUNCH` → `AFTER_SCENE_LAUNCH`。 |
| 1074.4–1125.1 | 第三次 `_updateCallback` 进入首次 `director.tick`，随后 `BEFORE_UPDATE` → `AFTER_UPDATE` → `BEFORE_DRAW` → `AFTER_DRAW`。 |

这里有一个值得单独记住的源码差异：`Game.EVENT_RENDERER_INITED` 的注释说它先于 `EVENT_ENGINE_INITED`，但这次实测顺序相反。当前源码中 `EVENT_ENGINE_INITED` 在 `game.ts:868` 的 Subsystem 末尾发出；`EVENT_RENDERER_INITED` 在 `_setRenderPipeline()`（`:1165-1172`）中发出，而 `_setupRenderPipeline()` 是 Project 阶段的步骤（`:892`）。对本项目的预览路径，应以源码调用点和本次运行记录为准，不能只依据事件常量上的注释。事件探针通过 `once` 监听，记录的是回调执行点。

## 对后续研究有用的边界

- 3.x 的 `game.init()` 和 `game.run()` 是两个明确阶段；排查“未启动”先核对初始化 Promise 是否完成，再核对 `Pacer`、启动画面、启动场景和 `director.tick`。
- `game.pause()` 停止 `Pacer`；`director.pause()` 只停止逻辑更新，`tick()` 仍可进入绘制段（`game.ts:591-608`、`director.ts:767-801`）。
- 本篇的 `System.import('cc')` 出现在 Web 桌面模板和当前浏览器预览中，不代表原生与小游戏采用相同加载器。平台差异留在阶段 10 独立研究。

## 后续范围

构建产物的 `settings.json` 与 `application.js`、原生/小游戏宿主和更深的渲染提交路径仍需分别研究；本文的时序结论仅适用于这次 3.8.7 编辑器预览运行。
