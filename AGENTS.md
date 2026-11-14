# 仓库工作路由

本仓库当前工作树以源码学习课程、研究资料和本地源码快照为主。Cocos Creator CLI 相关记录仍可能出现在 `docs/agent-foundation/`，应按历史设计资料阅读；不要据此假设当前仓库仍包含可运行的 CLI 实现。

## 先识别任务，再读取资料

| 任务 | 入口 |
| --- | --- |
| 修改 Cocos Creator 课程 | 先读 [课程总纲](docs/cocos-engine-course-master-outline.md) 和对应课程 `README.md`；再读目标课程及相邻课程，保持版本和课程结构一致。 |
| 研究 Creator 引擎源码 | 先确认版本，再读 `engine/2.4.15engine/` 或 `engine/3.8.7engine/` 中对应源码，以及 `docs/2.x/` 或 `docs/3.x/` 的相关专题。 |
| 修改或研究 Godot 课程 | 先读对应的 `learn_godot<主版本>/README.md` 和 `课程大纲.md`，再核对配套 `engine/godot-<版本>/version.py` 与 C++ 源码；跨版本比较分别建立各版本事实。 |
| 修改或研究 Cocos2d-x 课程 | 先读对应的 `learn_cocos2d-<版本>/README.md`，再核对 `engine/cocos2d-x-<版本>/` 和 `docs/cocos2d-x/` 中的资料。 |
| 跨 Creator / Cocos2d-x 版本比较 | 先分别建立各版本的源码事实；再只读 `docs/comparisons/` 中与当前主题对应的资料。 |
| C/C++ 或 OpenGL 练习 | 先读 `learn_cpp/README.md` 或 `learn_opengl/README.md`，按课程说明确认本机工具链和依赖。 |
| OpenAI、Anthropic、Claude Code、Game Studios 或 DeepSeek Harness 课程 | 先读对应 `learn_*` 目录的 `README.md` 和目标课；涉及易变的产品或 API 信息时核对官方资料。 |
| Creator CLI 历史设计记录 | 仅在任务涉及该历史主题时，按需读取 `docs/agent-foundation/` 中相关记录，并区分文档记载与当前实现。 |

课程 `README.md` 和课程大纲负责说明具体课次、依赖及运行方法；不要把所有课程的说明重复写入本文件。

## 仓库级约束

- **范围：** 只修改本次任务涉及的课程、资料或源码。不要顺手扩展到其他课程系列；跨版本同步仅在任务明确要求时进行。
- **版本：** 以课程 README 和本地快照标注为准。Creator 快照为 2.4.15 和 3.8.7；Godot 快照为 1.1、2.1.7-rc、3.6.4-rc、4.7.3-rc；Cocos2d-x 按 1.x–4.x 分目录保存。先确认版本再引用 API 或描述行为，不把一个版本的结论外推到其他版本。
- **源码与证据：** `engine/` 中的上游快照是课程研究依据。除非任务明确要求修改引擎源码，否则不要改动快照。说明结论时区分官方文档、静态源码、构建/测试、编辑器和目标运行时证据；标明版本、平台及尚未验证的部分。
- **课程示例：** 遵循对应课程自己的目录结构与运行方式。Creator 资源、场景和 Prefab 保留编辑器生成的 `.meta`、UUID 与引用；不要把 `library/`、`temp/`、`local/`、`build/` 等缓存或产物当作源文件。
- **外部准备：** 构建或运行前先核对课程要求的工具链、SDK、依赖和子模块。下载依赖、安装工具或修改全局环境前先取得用户授权。
- **文档检查：** 文档变更后检查相关链接、路径和目录名；只有任务要求或课程流程需要时才运行示例、构建或测试。
- **Git：** 保留工作区中已有的改动和删除，不重置、不恢复无关内容。提交前检查暂存区，只暂存本任务文件并使用中文提交说明。课程资料、课程入口/索引及配套示例统一在 `learn` 分支提交并推送；`main` 保持为主分支。
