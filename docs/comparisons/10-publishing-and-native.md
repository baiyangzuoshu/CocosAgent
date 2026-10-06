# 阶段 10：相同开发行为的 Web/原生对照

先读 [2.4 独立笔记](../2.x/10-publishing-and-native.md)与[3.8 独立笔记](../3.x/10-publishing-and-native.md)。以下以各版本示例的同一源场景在 Web 预览与 Mac 原生包中启动为共同问题。源码和两个 Mac 包已打点；Web 一侧复用阶段 1 的预览轨迹，尚无正式 Web 发布包轨迹。

| 行为/边界 | 2.4.15 | 3.8.7 |
| --- | --- | --- |
| 官网公开流程 | [2.4 Web](https://docs.cocos.com/creator/2.4/manual/zh/publish/publish-web.html)、[原生](https://docs.cocos.com/creator/2.4/manual/zh/publish/publish-native.html) | [3.8 Web](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-web.html)、[原生](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/native-options.html) |
| 平台分叉 | `gulp/util/utils.js` 生成 `CC_JSB` 等宏，`CCSys.js` 内判断并填写 `cc.sys`；小游戏适配器另需目标宿主。 | `cc.config.json` 按 `HTML5/NATIVE/MINIGAME` 等构建常量映射 `pal/system-info`、`pal/env` 等实现；`sys.ts` 对外代理。 |
| 小游戏系统身份 | `CCSys.js` 先给出通用 `isNative/isBrowser` 值，再允许 `__globalAdapter.adaptSys` 覆盖；本仓库缺目标适配器/运行包，不能推出最终值。 | `pal/system-info/minigame` 明确设 `isNative=false`、`isBrowser=false`；`pal/env/minigame` 按目标选择宿主加载器。仍待小游戏实测。 |
| 原生宿主到脚本 | 本 Mac 包 `AppDelegate.cpp` 启动 JSB、`jsb-builtin.js`、`main.js`。 | 引擎 `CocosApplication.cpp → BaseGame.cpp` 启动 JSB、`web-adapter.js`、`main.js`。 |
| 脚本到游戏 | 本 Mac 包 `main.js` 加载引擎/脚本/Bundle，再 `cc.game.run(..., onStart)` 并加载启动场景。 | 本 Mac 包 `main.js` 经 SystemJS 加载 `application.js`/`cc`/`engine-adapter`，`Application.start → game.init(...).then(game.run)`。 |
| 帧驱动 | `CCGame._setAnimFrame` 按 `CC_JSB/CC_RUNTIME` 选择原生适配器帧函数或 Web rAF/定时器，`_runMainLoop → director.mainLoop`。 | `Game.initPacer` 统一接 `Pacer.onTick`；Web/Native 是不同 Pacer 实现，Native 还经 C++ `events::Tick → gameTick`。 |
| 脚本调用原生帧率设置 | `CCGame.js` 调 `jsb.setPreferredFramesPerSecond`；本工作区没有 2.4 的 C++ 绑定实现，链在 JSB 接口处止步。 | Native Pacer 调同名 JSB API；`jsb_global.cpp` 转参并调用 `Engine::setPreferredFramesPerSecond → BasePlatform::setFps`，本仓库可追到平台调用。 |
| 可修改位置 | 项目源、2.4 引擎源、官网所述构建模板；当前仓库不含完整编辑器构建器和 2.4 JSB 适配器源。 | 项目源、3.8 引擎 `pal/platforms/native` 和 C++ 源、构建模板；仍不含完整编辑器构建器。 |

## 共同诊断路线

从官网对应目标的构建选项和项目源场景出发，记录实际构建配置与所用引擎，检查生成启动文件，然后沿平台分叉追至 `sys`、适配器和原生绑定。只在相同场景、相同事件和明确的 Web/Native 运行环境下比较输出；预览、构建包、Mac 与小游戏各自单列。`window` 或 `document` 是否存在不能单独判定平台，原生适配器也可创建这些对象。

两版[2.4 Mac 原生轨迹](../agent-foundation/traces/2.4.15-stage10-mac-native-startup.jsonl)和[3.8 Mac 原生轨迹](../agent-foundation/traces/3.8.7-stage10-mac-native-startup.jsonl)都测到 `window/document` 存在而 `isBrowser=false`；2.4 `platform=2/MACOS`，3.8 `platform=MACOS`。这是各自已生成包的观察，不代表所有原生平台。

阶段 1 的[2.4 Web 预览启动轨迹](../agent-foundation/traces/2.4.15-preview-startup.jsonl)与[3.8 Web 预览启动轨迹](../agent-foundation/traces/3.8.7-preview-startup.jsonl)可提供各自预览链的事件顺序参照；它们不是本阶段的正式 Web 发布包，也没有与 Mac 原生轨迹共用时钟。跨平台只比较事件关系，不比较这些记录的绝对毫秒值。

| 同一源场景的观察 | Web 预览（阶段 1） | Mac 已发布包（阶段 10） |
| --- | --- | --- |
| 2.4 Hello World | `engine-inited → game-inited/onStart → after-scene-launch → first-after-draw` | `engine-inited → game-inited/onStart → first-after-draw → after-scene-launch → first-scene-after-draw` |
| 3.8 3D main | `post-base → post-subsystem → engine-inited/game-inited → 预览场景获取/启动 → first-after-draw` | `post-base → post-subsystem → engine-inited/game-inited → first-after-draw → game.onStart/after-scene-launch → first-scene-after-draw` |

两版 Mac 包的第一次 `AFTER_DRAW` 都早于场景启动；下一次标记的 `AFTER_DRAW` 才发生在场景启动之后。3.8 源码 `_updateCallback` 在启动场景前有 SplashScreen 分支，能解释原生包场景前的绘制回调；2.4 仅能确认渲染循环先于异步场景加载完成。预览宿主与发布包启动脚本、Splash/加载方式不同，**不能把表中差异直接归因于 Web 与 Native 平台本身**。回调也不等于显示器实际呈现帧。

## 证据边界

两版 Mac 构建目录是先前生成的快照。3.8 的 `cocos.compile.config.json` 明确指向 Creator 安装包内置的 TS/Native 引擎；2.4 本地构建配置尚不能判定引擎来源。两版编辑器构建器实现与小游戏宿主缺席。现有观察证明这些包的启动事件关系，不能推广为正式 Web 包、移动端或小游戏的相同表现。验证状态见[阶段 10 记录](../agent-foundation/skills/publishing-native-validation.md)。
