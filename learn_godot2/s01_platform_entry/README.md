# 第 1 课：平台 `main()` 到 `Main`

**目标：** 以 Godot 2.1 的 macOS 桌面入口为例，追踪原生 `main()` 如何把参数和控制权交给 `Main`，再用主场景脚本观察项目启动抵达 `_ready()`。

## 本课问题

平台 `main()` 传给 `Main::setup()` 的参数是什么？启动错误和正常启动分别沿什么路径返回？2.1 的主场景设置如何进入节点回调？

## C++ 源码追踪

以下路径相对于 `engine/godot-2.1/` 快照根目录：

- `platform/osx/godot_main_osx.mm:38-87`：macOS 入口先跳过系统注入的 `-NSDocumentRevisionsDebugMode` 参数，并处理从 Finder 启动 app bundle 的工作目录；之后构造 `OS_OSX`，调用 `Main::setup()` 和 `Main::start()`，由 `os.run()` 进入平台循环，结束时清理并返回 OS 的退出码。
- `main/main.cpp:199-209`：`Main::setup()` 初始化 OS 核心与 `ObjectTypeDB`，并注册核心类型。入口提供的 `argc/argv` 在此进入引擎启动流程。
- `main/main.cpp:1010`、`1124-1125`：`Main::start()` 在未通过命令行选择场景时读取 `application/main_scene`。本实验的 `engine.cfg` 指向 `main.tscn`。
- `platform/osx/os_osx.mm:1952-1979`、`scene/main/scene_main_loop.cpp:461-471`：`OS_OSX::run()` 调用主循环 `init()`；`SceneTree::init()` 把 root 接入 SceneTree，然后平台循环开始调用 `Main::iteration()`。
- `scene/main/node.cpp:1911-1930`、`139-148`、`100-105`：`Node::_set_tree()` 传播 enter-tree 与 READY；`NOTIFICATION_READY` 最终调用挂载脚本的 `_ready()`。

路径摘要：macOS `main()` → `Main::setup(argv)` → `Main::start()` 选择主场景/主循环 → `OS_OSX::run()` → `SceneTree::init()` → Node READY → GDScript `_ready()`。S02 会继续拆解 `Main::setup()` 内部的参数与项目初始化。

## 最小实验

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

## 本课 C++ 源码摘录

课内摘录保留对应 Godot 源码行段正文，并在段首标出原始行号；完整上下文以只读的 engine 快照为准。摘录用于追踪，不是独立编译单元。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | Godot 源文件 | 上游行段 |
| --- | --- | --- |
| [main.cpp](src/upstream/main/main.cpp.excerpt) | godot-2.1/main/main.cpp | 199-209, 1010-1010 |
| [godot_main_osx.mm](src/upstream/platform/osx/godot_main_osx.mm.excerpt) | godot-2.1/platform/osx/godot_main_osx.mm | 38-87 |
| [os_osx.mm](src/upstream/platform/osx/os_osx.mm.excerpt) | godot-2.1/platform/osx/os_osx.mm | 1952-1979 |
| [node.cpp](src/upstream/scene/main/node.cpp.excerpt) | godot-2.1/scene/main/node.cpp | 1911-1930 |
| [scene_main_loop.cpp](src/upstream/scene/main/scene_main_loop.cpp.excerpt) | godot-2.1/scene/main/scene_main_loop.cpp | 461-471 |
