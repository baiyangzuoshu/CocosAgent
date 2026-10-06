# 阶段 10：2.4.15 发布与原生

状态：官网基线、源码链和现有 Mac 包的启动/首次绘制事件轨迹已建立；Web 一侧使用阶段 1 的同场景预览轨迹，正式 Web 发布包与小游戏仍待验证。

## 官网基线与范围

- [2.4 跨平台发布](https://docs.cocos.com/creator/2.4/manual/zh/publish/)按目标平台组织构建与发布；[Web 发布](https://docs.cocos.com/creator/2.4/manual/zh/publish/publish-web.html)、[原生发布](https://docs.cocos.com/creator/2.4/manual/zh/publish/publish-native.html)分别描述生成内容和运行方式。
- [微信小游戏发布](https://docs.cocos.com/creator/2.4/manual/zh/editor/publish/publish-wechatgame.html)是另一目标平台；不能以桌面浏览器模拟它的宿主 API。
- [JSB 自动绑定](https://docs.cocos.com/creator/2.4/manual/zh/advanced-topics/jsb-auto-binding.html)与[手动绑定](https://docs.cocos.com/creator/2.4/manual/zh/advanced-topics/jsb-manual-binding.html)给出脚本/原生协作的开发者入口。手册未规定本示例启动每个内部调用的精确时序。

## 本仓库的分层地图

| 层 | 证据与职责 |
| --- | --- |
| 引擎 JavaScript | `2.4.15engine/predefine.js` 的 `CC_JSB` 等构建宏，`cocos2d/core/platform/CCSys.js` 的 `cc.sys` 平台与能力判断，`cocos2d/core/CCGame.js` 的游戏循环。 |
| 引擎构建 | `2.4.15engine/gulp/util/utils.js::getMacros` 生成压缩时的全局宏；平台目标的选择不能仅凭运行时 `window.jsb` 推断。 |
| Creator 生成的项目包 | `2.4.15NewProject/build/jsb-link/main.js` 及 `frameworks/runtime-src/Classes/AppDelegate.cpp` 是当前 Mac 构建快照；`jsb-adapter/jsb-builtin.js`、`jsb-engine.js` 是生成/拷入的适配层。它们不是该引擎目录中的适配器源文件。 |
| 编辑器构建器与宿主 | 本地没有完整 Creator 编辑器构建器、平台商店或小游戏宿主源码；从构建产物只能核对结果，不能反推出所有构建阶段。 |

## 同一项目的 Mac 原生启动链（静态）

`AppDelegate::applicationDidFinishLaunching` 注册 JSB 模块并启动 `se::ScriptEngine`，先 `jsb_run_script("jsb-adapter/jsb-builtin.js")`，再运行 `main.js`。生成的 `main.js` 在 `window.jsb` 分支加载 `settings`、`cocos2d-jsb`、按宏加载物理包、`jsb-engine.js`，然后 `window.boot()`。`boot` 初始化 Asset Manager、加载内置/资源包和脚本、加载 `main` Bundle，再 `cc.game.run(option, onStart)`；`onStart` 加载启动场景并交给 `cc.director.runSceneImmediate`。该构建包的可观测节点已由下面的原生轨迹打点。

项目 `local/builder.json` 记录 Mac 目标、link 模板及发布模式，`settings/builder.json` 记录启动场景、MD5 缓存和 `encryptJs=true`；包内脚本有 `.jsc` 加密产物。两份配置均未给出本次构建的引擎源码路径。`build/jsb-link/main.js` 与发布 `.app` 内同名文件当前 SHA-256 一致，但这只能关联两份生成入口，不能证明使用邻接 `2.4.15engine/`。

平台判断分两层：`predefine.js` 在构建包中采用注入的 `CC_JSB` 宏，在非构建路径用 `jsb` 全局推断；`CCSys.js` 设置 `sys.isNative = CC_JSB`，而 `sys.isBrowser` 还要求 `window`、`document` 且排除 JSB/Runtime。原生宿主也可提供类 DOM 对象，所以不能以 `window` 存在判断 Web。`CCSys.js` 原生分支还调用宿主提供的 `__getPlatform`、`__getOS` 等函数；这些函数的原生实现不在 2.4 引擎 JavaScript 目录内。

小游戏需额外注意 `CCSys.js` 在普通平台分支前先检查 `_global.__globalAdapter.adaptSys(sys)`，若存在便由适配器填写系统信息。这个仓库没有用于当前目标小游戏的适配器源码，也没有小游戏发布包；`sys.isBrowser` 的初始表达式不能替代最终 `adaptSys` 结果。诊断必须记录具体小游戏目标、适配器和宿主输出。

## 帧驱动分叉（静态）

`CCGame.js::_prepareFinished` 完成内置资源初始化后设 `_prepared`、调用 `_runMainLoop`，再发 `EVENT_GAME_INITED` 和启动回调；因此该事件不是“第一帧已绘制”。`_setAnimFrame` 在 JSB/Runtime 分支调用 `jsb.setPreferredFramesPerSecond` 并使用适配器的 `requestAnimationFrame`，Web 分支按帧率选择浏览器 rAF、定时器或组合策略；`_runMainLoop` 的回调最终进入 `director.mainLoop(now)`。在本 Mac 生成包，`jsb-builtin.js` 设置 `window.gameTick = tick` 并提供类浏览器帧函数；原生触发 `gameTick` 的实现位于生成框架/宿主，当前 2.4 引擎 JavaScript 源无法单独证明其精确调度顺序。

脚本/原生边界的具体入口是 `CCGame.js::_setAnimFrame → jsb.setPreferredFramesPerSecond(frameRate)` 和 `CCSys.js → __getPlatform()` 等全局绑定。2.4.15 引擎目录只有 JavaScript 层，本示例 `frameworks/runtime-src/Classes/AppDelegate.cpp` 只负责初始化与执行脚本；C++ 绑定及帧率平台实现没有作为可核对源码出现在这四个工作区目录内。不能把 3.8 的 C++ 绑定实现反推到 2.4。

## 面向游戏开发者的诊断

遇到只在发布包出现的问题，先保存 Creator 目标平台和调试/发布选项，再确认实际包中的宏、脚本加载顺序、`cc.sys.platform/isNative/isBrowser`、Bundle 配置和启动场景。不要把 Web 预览的 `main.js` 或 `cc.sys` 输出直接当作 Mac、移动端或小游戏结果。修改引擎前还须确认示例是否使用自定义引擎。

## 已验证切口与待验证

1. 已对同一示例源场景记录 Web 预览与 Mac 原生包的系统标志、启动事件和首次绘制回调；若要归因于平台，仍需与正式 Web 发布包在相同构建条件下复测。
2. 核对当前 Mac 构建产物是否确由本地 `2.4.15engine` 生成；仅凭邻接目录不成立。
3. 小游戏需目标开发工具/宿主实测；本机无对应发布包与运行轨迹。

[Mac 启动冒烟记录](../agent-foundation/traces/stage10-mac-native-startup-smoke.jsonl)中进程输出 `Cocos Creator v2.4.15`，只证明该已生成包到达引擎启动阶段。

用[可复跑探针](../agent-foundation/probes/stage10-mac-startup-2.4.py)在发布 `.app` 的生成 `main.js` 临时打点，得到[原生启动轨迹](../agent-foundation/traces/2.4.15-stage10-mac-native-startup.jsonl)：`boot → engine-inited → game-inited/onStart → first-after-draw → after-scene-launch → first-scene-after-draw`，源场景为 `helloworld.fire`。`runSceneImmediate` 返回后的 `scene-run` 日志在 `after-scene-launch` 之后，符合该方法内部同步派发事件。首次 `AFTER_DRAW` 早于场景启动事件，不能称为场景首帧；场景启动后约 9 ms 的再次 `AFTER_DRAW` 才是探针定义的首次场景绘制回调。

`CC_JSB=true`、`CC_RUNTIME=false`、`isNative=true`、`isBrowser=false`、`platform=2`（`CCSys.js` 定义为 `MACOS`），但 `window` 和 `document` 都存在。这在当前包中实证了类 DOM 全局不等于 Web。探针仅记录事件回调，不证明屏幕最终呈现时间；生成文件已恢复为原 SHA-256 `f05618770c05d8254fda1bc24a6e95ce6db29c11dc42847fc1a9119ae6798a24`。
