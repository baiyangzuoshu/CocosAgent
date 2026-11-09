# 第 29 课（ENG01）：Cocos2d-x 源码版本与目录地图

**目标：** 用仓库中的版本标记、Git 记录和构建清单确认正在阅读的 Cocos2d-x 快照，并分辨核心引擎、扩展、依赖、测试、模板和工具目录。

## 本课问题

- 本地源码有哪些证据表明它标记为 Cocos2d-x 4.0？
- 哪些目录属于引擎核心，哪些目录提供扩展、第三方依赖、测试和项目模板？
- 当前证据能证明什么，哪些构建或运行状态还没有验证？

## 代码结构

本课不添加引擎代码。观察对象是仓库内的 `engine/cocos2d-x-4/`：

~~~text
engine/cocos2d-x-4/
├── cocos/       # 引擎核心模块
├── extensions/  # 扩展模块
├── external/    # 第三方依赖与版本信息
├── tests/       # C++、Lua 和性能测试工程
├── templates/   # C++ 与 Lua 项目模板
├── tools/       # 控制台、绑定生成和开发工具
├── docs/        # 架构、发布与开发文档
└── CMakeLists.txt
~~~

## 本地版本证据

| 检查项 | 本地证据 | 可以得出的结论 |
| --- | --- | --- |
| 发布标记 | [`CHANGELOG`](../../engine/cocos2d-x-4/CHANGELOG) 首行写有 `cocos2d-x-4.0` 和发布日期；[`cocos/cocos2d.h`](../../engine/cocos2d-x-4/cocos/cocos2d.h) 定义 `COCOS2D_VERSION` 为 `0x00040000` | 本地源码标记为 Cocos2d-x 4.0 |
| 根仓库记录 | 根 Git 中最近一次修改该源码树的提交为 `8f14d66c0c9d31f305935b978d832103a3399d2d`（2026-10-25，迁移引擎源码） | 可追溯本地仓库何时迁入/调整这份源码；它不是 Cocos2d-x 上游提交号 |
| 构建组织 | 根 [`CMakeLists.txt`](../../engine/cocos2d-x-4/CMakeLists.txt) 分别加入 `cocos/`、测试工程和 C++ 模板工程 | 能识别当前 CMake 构建入口和目标区域；不代表已经成功配置或构建 |

版本判断以本地文件为准。上游 v4 文档用于了解公开概念，但不能替代当前目录内容，也不能据此推断此源码树对应某个未记录的上游 tag 或 commit。

## 目录地图

- [`cocos/`](../../engine/cocos2d-x-4/cocos/) 是引擎核心。当前快照按 `2d`、`3d`、`base`、`math`、`platform`、`renderer`、`audio`、`physics`、`physics3d`、`network`、`navmesh`、`scripting`、`ui` 和 `editor-support` 等模块组织。`cocos/cocos2d.h` 是聚合多个公开头文件的入口之一。
- [`extensions/`](../../engine/cocos2d-x-4/extensions/) 放置核心之外的扩展，例如 `GUI`、`Particle3D`、`assets-manager` 和 `physics-nodes`。
- [`external/`](../../engine/cocos2d-x-4/external/) 与 [`external/version.json`](../../engine/cocos2d-x-4/external/version.json) 记录第三方库和预编译依赖相关内容。目录存在不等于目标平台依赖已经准备齐全。
- [`tests/`](../../engine/cocos2d-x-4/tests/) 包含 `cpp-tests`、`lua-tests`、`performance-tests` 以及空白测试工程。测试资源和运行环境需另行核对。
- [`templates/`](../../engine/cocos2d-x-4/templates/) 提供默认 C++ 与 Lua 工程模板；根 CMake 文件将 C++ 模板加入构建树。
- [`tools/`](../../engine/cocos2d-x-4/tools/) 包含代码风格、绑定生成、发布和控制台等工具。
- [`docs/`](../../engine/cocos2d-x-4/docs/) 包含发布说明、架构图和开发文档。README 中的在线 v4 手册链接是公开资料入口，不是本地源码实现证据。

## 依赖与证据边界

- [`engine/cocos2d-x-4/.gitmodules`](../../engine/cocos2d-x-4/.gitmodules) 列出上游的 `cocos2d-console`、`bindings-generator` 和 `ccs-res` 子模块路径。本轮观察到这些目录没有文件；不要据 `.gitmodules` 文件存在就认为子模块已初始化。
- 上游 [`README.md`](../../engine/cocos2d-x-4/README.md) 要求准备依赖并更新子模块。执行构建前应重新核对工具链、依赖和子模块状态；本课不运行 `download-deps.py`、不初始化子模块，也不改全局环境。
- 本课证据是**本地文档、源码和 Git 记录的静态检查**。没有进行 CMake 配置、编译、测试或目标平台运行，因此不形成构建或运行时验收结论。
- 后续课程会从工程结构和构建目标开始，再逐步追踪平台入口、应用初始化、场景和渲染；本课只定位地图，不把入口调用链提前当作已验证事实。

## 动手练习

1. 对照 `CHANGELOG` 和 `COCOS2D_VERSION` 宏记录本地版本证据，并区分上游版本标记与根仓库提交记录。
2. 从 `cocos/CMakeLists.txt` 和根 `CMakeLists.txt` 各找一处构建接线，说明核心源码如何进入构建树。
3. 查阅 `.gitmodules` 和 `external/README.md`，列出开始构建前仍需核实的外部条件；不要为了完成本课下载或安装依赖。

## 简化说明

- 目录职责根据当前本地树、CMake 文件和 README 归纳；它是源码导航图，不是每个目录所有功能的完整清单。
- Git 提交 `8f14d66c0...` 记录根仓库对本地源码树的修改，不提供独立的上游 Cocos2d-x commit 身份。
- 模块存在、CMake 中存在接线和源码静态可读，分别都不能替代构建或运行证据。

## 参考资料

- [仓库 Cocos2d-x 4.0 与 Creator 2.4.15 对照研究计划](../../docs/cocos2d-x-creator2x-source-study-plan.md)
- [本地 Cocos2d-x README](../../engine/cocos2d-x-4/README.md)
- [本地 Cocos2d-x CHANGELOG](../../engine/cocos2d-x-4/CHANGELOG)
