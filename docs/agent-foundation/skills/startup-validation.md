# 启动链路 skill 草案验证记录

本记录对应 `cocos2-startup-trace` 与 `cocos3-startup-trace`。验证方式是把真实可能出现的问题按 skill 指引重新定位到源码，检查版本选择、路径与结论边界。另在对应版本的 Creator 中启动浏览器预览：2.x 的 Hello World 与 3.x 的 3D 场景均成功显示。通过临时本机代理在预览宿主脚本调用前插入事件监听，并在 Chrome 图形预览中记录[2.x](../traces/2.4.15-preview-startup.jsonl)和[3.x](../traces/3.8.7-preview-startup.jsonl)时序；没有修改工程或引擎源码。

## 官网手册校准（2026-10-02）

| 核对项 | 结果 |
| --- | --- |
| 项目身份 | [2.4 项目结构](https://docs.cocos.com/creator/2.4/manual/zh/getting-started/project-structure.html)要求识别根目录 `project.json` 与 `assets/`；[3.8 项目结构](https://docs.cocos.com/creator/3.8/manual/zh/getting-started/project-structure/index.html)使用根目录 `package.json` 与 `assets/`。两示例均核对到对应文件；两份 skill 已明确该版本边界。 |
| 预览条件 | [2.4 预览手册](https://docs.cocos.com/creator/2.4/manual/zh/getting-started/basics/preview-build.html)针对已打开场景的浏览器/模拟器预览；[3.8 预览手册](https://docs.cocos.com/creator/3.8/manual/zh/editor/preview/index.html)还可选择预览场景，默认当前场景。既有打点仅覆盖两套 Chrome 当前场景预览，skill 已要求先确认平台和场景选择。 |
| 公开场景 API 与预览宿主 | 两版[场景加载手册（2.4）](https://docs.cocos.com/creator/2.4/manual/zh/scripting/scene-managing.html)、[场景加载手册（3.8）](https://docs.cocos.com/creator/3.8/manual/zh/scripting/scene-managing.html)说明 `director.loadScene` 的公开用法；本次预览由宿主加载 JSON 后调用 `runSceneImmediate`。3.8 [预览流程文档](https://docs.cocos.com/creator/3.8/manual/zh/editor/preview/preview-guid.html)以 `settings.json` 描述生成配置，本次浏览器实际请求 `settings.js`。两份 skill 已要求检查实际响应与宿主代码，不把内部路径写成官网公开保证。 |

校准没有改变原始事件记录，也没有重新运行预览。四个既有排障案例仍按原源码和打点证据成立；本次新增的是官方用法、项目身份和预览适用条件的判定入口。手册没有给出精确的引擎初始化或首帧事件时序，这些结论仍只适用于已核对的源码快照与预览环境。

| 案例 | skill 的定位结果 | 核对证据 |
| --- | --- | --- |
| 2.x：`EVENT_ENGINE_INITED` 已触发，但没有组件帧回调 | 从 `CCGame._prepareFinished` 检查内建资源回调、`_prepared` 与 `_runMainLoop`，再查 `CCDirector.mainLoop` 的暂停状态；不能仅凭引擎事件断定帧循环已开始。 | `2.4.15engine/cocos2d/core/CCGame.js:387-400,625-651`、`CCDirector.js:870-913` |
| 2.x：示例配置有起始场景 UUID，为什么仍黑屏？ | 对照 `settings/project.json` 与 `.fire.meta` 确认场景身份，再检查预览 `boot.js` 的 bundle 加载、`game.run`、`onStart`、`preview-scene.json` 与 `runSceneImmediate`。实测 `onStart` 在 `GAME_INITED` 后，首个 `mainLoop` 在场景启动后。 | 预览 `settings.js`、`boot.js`、[2.x 记录](../traces/2.4.15-preview-startup.jsonl) |
| 3.x：先调用 `game.run()` 却没有帧回调 | `run()` 在 `_inited` 为假时返回；应先核对 `init()` Promise 是否完成，然后才检查 `Pacer` 和 `director.tick`。 | `3.8.7engine/cocos/game/game.ts:734-915,1031-1039,1090-1096` |
| 3.x：`assets/scene/main.scene` 存在，却不知道是否被启动 | 检查实际宿主。此预览的 `settings.js` 给出 `current_scene`，`preview-app/main.js` 将自动启动配置清空，再手动请求当前场景 JSON。skill 区分了编辑器预览、Web 构建模板和其他平台。 | 预览 `settings.js`、`preview-app/main.js`、[3.x 记录](../traces/3.8.7-preview-startup.jsonl) |

以上四例都能定位到正确版本的源码入口，并保留缺失证据的边界。校准后两份 `SKILL.md` 的 YAML frontmatter 已通过 Ruby 标准 YAML 解析器检查。安装 PyYAML 6.0.3 后，又使用当前 Homebrew Python 3.13 分别运行 `skill-creator/scripts/quick_validate.py`，两份 skill 均输出 `Skill is valid!`。

本次实测还发现 3.x 预览的 `EVENT_RENDERER_INITED` 晚于 `EVENT_ENGINE_INITED`；源码调用点支持该顺序，事件常量注释却描述了相反顺序。两份 skill 已据此修订。下一阶段研究仍需继续按平台和宿主类型分别取证。
