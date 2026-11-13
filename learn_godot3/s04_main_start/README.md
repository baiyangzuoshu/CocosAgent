# 第 4 课：`Main::start()`、主场景装载与 `SceneTree` 创建

**目标：** 追踪 Godot 3.6 `Main::start()` 如何决定主循环类型、使用项目主场景、实例化 `PackedScene` 并把它设为当前场景。

## 本课问题

项目主场景配置何时参与启动？默认 `MainLoop` 类型是什么？场景实例与 OS 主循环分别在哪一步交接？

## C++ 源码追踪

以下路径相对于 `engine/godot-3.6/` 快照根目录：

- `main/main.cpp:1682`：`Main::start()` 进入最终启动阶段。
- `main/main.cpp:1859-1867`：未指定脚本或场景路径时读取 `application/run/main_scene`，并从 `application/run/main_loop_type` 选择主循环。
- `main/main.cpp:1927-1948`：未指定主循环类型时默认 `SceneTree`，再由 ClassDB 创建主循环并转为 `SceneTree`。
- `main/main.cpp:2193-2206`：运行游戏时通过 `ResourceLoader` 加载场景、调用 `PackedScene::instance()`，再用 `add_current_scene()` 设置当前场景并接到 root。
- `main/main.cpp:2259`、`scene/main/scene_tree.cpp:521-525`：OS 接收主循环；SceneTree 初始化时把 root 接入树并执行 `MainLoop::init()`。
- `scene/main/node.cpp:3132`、`scene/main/scene_tree.cpp:2119`、`2159`：GDScript 可通过 `get_tree().get_current_scene()` 读取当前场景。

调用摘要：项目配置和启动参数确定 scene path / loop type → ClassDB 创建默认 `SceneTree` → 加载并实例化 `PackedScene` → 设为当前场景并加入 root → OS 持有主循环 → SceneTree 初始化。

## 最小实验

- `project.godot`：Godot 3.6 项目配置，版本 4，指定 `main.tscn`。
- `main.tscn`：format 2 文本场景，root Node 挂接脚本。
- `start_probe.gd`：在 `_ready()` 打印当前场景名。

在本目录运行：

```sh
godot --path .
```

预期输出 `S04MainScene`。这说明脚本可从 SceneTree 读取当前场景；`Main::start()` 中从配置到 PackedScene 实例的路径由 C++ 源码追踪。

## 简化与边界

实验仅走项目设置中的默认 `SceneTree` 和主场景，不覆盖脚本型 MainLoop、编辑器、自定义命令行场景及其他平台的 `OS::run()` 实现。Godot 3.6 使用 `VisualServer`、`PackedScene::instance()` 和 format 2 场景；本课未运行。
