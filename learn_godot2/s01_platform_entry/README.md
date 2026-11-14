# 第 1 课：平台 `main()` 到 `Main`

**目标：** 以 Godot 2.1 的 macOS 桌面入口为例，追踪原生 `main()` 如何把参数和控制权交给 `Main`，再用主场景脚本观察项目启动抵达 `_ready()`。

## 本课增量

把平台入口的控制权交接写成可执行状态流程，分别观察 setup 成功进入 Main::start 和失败提前返回。

**本课要回答：** 平台 `main()` 传给 `Main::setup()` 的参数是什么？启动错误和正常启动分别沿什么路径返回？2.1 的主场景设置如何进入节点回调？

## C++ 源码追踪

源码依据：`engine/godot-2.1/`（Godot 2.1 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-2.1/` 快照根目录：

- `platform/osx/godot_main_osx.mm:38-87`：macOS 入口先跳过系统注入的 `-NSDocumentRevisionsDebugMode` 参数，并处理从 Finder 启动 app bundle 的工作目录；之后构造 `OS_OSX`，调用 `Main::setup()` 和 `Main::start()`，由 `os.run()` 进入平台循环，结束时清理并返回 OS 的退出码。
- `main/main.cpp:199-209`：`Main::setup()` 初始化 OS 核心与 `ObjectTypeDB`，并注册核心类型。入口提供的 `argc/argv` 在此进入引擎启动流程。
- `main/main.cpp:1010`、`1124-1125`：`Main::start()` 在未通过命令行选择场景时读取 `application/main_scene`。本实验的 `engine.cfg` 指向 `main.tscn`。
- `platform/osx/os_osx.mm:1952-1979`、`scene/main/scene_main_loop.cpp:461-471`：`OS_OSX::run()` 调用主循环 `init()`；`SceneTree::init()` 把 root 接入 SceneTree，然后平台循环开始调用 `Main::iteration()`。
- `scene/main/node.cpp:1911-1930`、`139-148`、`100-105`：`Node::_set_tree()` 传播 enter-tree 与 READY；`NOTIFICATION_READY` 最终调用挂载脚本的 `_ready()`。

路径摘要：macOS `main()` → `Main::setup(argv)` → `Main::start()` 选择主场景/主循环 → `OS_OSX::run()` → `SceneTree::init()` → Node READY → GDScript `_ready()`。S02 会继续拆解 `Main::setup()` 内部的参数与项目初始化。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [199-209 ; 1010-1010](src/upstream/main/main.cpp.excerpt) | engine/godot-2.1/main/main.cpp |
| 2 | [godot_main_osx.mm](src/upstream/platform/osx/godot_main_osx.mm) | [38-87](src/upstream/platform/osx/godot_main_osx.mm.excerpt) | engine/godot-2.1/platform/osx/godot_main_osx.mm |
| 3 | [os_osx.mm](src/upstream/platform/osx/os_osx.mm) | [1952-1979](src/upstream/platform/osx/os_osx.mm.excerpt) | engine/godot-2.1/platform/osx/os_osx.mm |
| 4 | [node.cpp](src/upstream/scene/main/node.cpp) | [1911-1930](src/upstream/scene/main/node.cpp.excerpt) | engine/godot-2.1/scene/main/node.cpp |
| 5 | [scene_main_loop.cpp](src/upstream/scene/main/scene_main_loop.cpp) | [461-471](src/upstream/scene/main/scene_main_loop.cpp.excerpt) | engine/godot-2.1/scene/main/scene_main_loop.cpp |

## GDScript 源码复刻

S01 Godot 2.1: macOS entry forwards argv and preserves setup/start error gates.

source_replay.gd 按本课指定快照复刻控制流与状态传递，模型中的状态字段、函数入口和 API 名称对应本代 C++ 路径。根目录实验脚本先运行模型，再调用对应版本的 Godot API。

| GDScript 函数 | 复刻步骤 |
| --- | --- |
| _new_run() | 初始化平台入口的阶段状态 |
| _platform_main() | 按平台入口顺序执行 setup/start/run 并走错误门 |
| _main_setup() | 执行核心/项目初始化并让错误状态提前返回 |
| _main_start() | 只在 setup 成功后安装主场景和 MainLoop |
| _print_trace() | 输出成功或错误路径中的阶段记录 |

## 最小 Godot/GDScript 实验

- `engine.cfg`：Godot 2.1 项目配置和主场景路径。
- `main.tscn`：format 1 文本场景，只有一个挂载脚本的 Node。
- `entry_probe.gd`：在 `_ready()` 打印主场景启动标记。

使用 Godot 2.1 编辑器打开本目录并运行项目，或在本目录执行：

```sh
godot -path .
```

预期看到 `S01 reached: the main scene root entered READY.`。此观察说明主场景脚本已运行；它不证明运行二进制与 `2.1.7-rc` 快照来自同一提交。

## 简化与边界

本课选择 macOS 入口作代表，不覆盖其他平台适配器。2.1 使用 `engine.cfg`、`application/main_scene` 和 `PackedScene::instance()` 一代场景机制；不要用后续版本的 `project.godot` 或 `instantiate()` 命名解释它。运行结果需记录实际 Godot 工具版本；旧版引擎运行验证尚未执行。

## 下一课

继续阅读 [s02_main_setup](../s02_main_setup/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
