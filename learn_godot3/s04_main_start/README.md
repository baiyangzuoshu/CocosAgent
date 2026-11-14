# 第 4 课：`Main::start()`、主场景装载与 `SceneTree` 创建

**目标：** 追踪 Godot 3.6 `Main::start()` 如何决定主循环类型、使用项目主场景、实例化 `PackedScene` 并把它设为当前场景。

## 本课增量

把主场景资源、PackedScene 实例、SceneTree root/current_scene 和节点进入/READY 通知接成完整路径。

**本课要回答：** 项目主场景配置何时参与启动？默认 `MainLoop` 类型是什么？场景实例与 OS 主循环分别在哪一步交接？

## C++ 源码追踪

源码依据：`engine/godot-3.6/`（Godot 3.6 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-3.6/` 快照根目录：

- `main/main.cpp:1682`：`Main::start()` 进入最终启动阶段。
- `main/main.cpp:1859-1867`：未指定脚本或场景路径时读取 `application/run/main_scene`，并从 `application/run/main_loop_type` 选择主循环。
- `main/main.cpp:1927-1948`：未指定主循环类型时默认 `SceneTree`，再由 ClassDB 创建主循环并转为 `SceneTree`。
- `main/main.cpp:2193-2206`：运行游戏时通过 `ResourceLoader` 加载场景、调用 `PackedScene::instance()`，再用 `add_current_scene()` 设置当前场景并接到 root。
- `main/main.cpp:2259`、`scene/main/scene_tree.cpp:521-525`：OS 接收主循环；SceneTree 初始化时把 root 接入树并执行 `MainLoop::init()`。
- `scene/main/node.cpp:3132`、`scene/main/scene_tree.cpp:2119`、`2159`：GDScript 可通过 `get_tree().get_current_scene()` 读取当前场景。

调用摘要：项目配置和启动参数确定 scene path / loop type → ClassDB 创建默认 `SceneTree` → 加载并实例化 `PackedScene` → 设为当前场景并加入 root → OS 持有主循环 → SceneTree 初始化。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [1682-1682 ; 1859-1867 ; 1927-1948 ; 2193-2206 ; 2259-2259](src/upstream/main/main.cpp.excerpt) | engine/godot-3.6/main/main.cpp |
| 2 | [node.cpp](src/upstream/scene/main/node.cpp) | [3132-3132](src/upstream/scene/main/node.cpp.excerpt) | engine/godot-3.6/scene/main/node.cpp |
| 3 | [scene_tree.cpp](src/upstream/scene/main/scene_tree.cpp) | [521-525 ; 2119-2119](src/upstream/scene/main/scene_tree.cpp.excerpt) | engine/godot-3.6/scene/main/scene_tree.cpp |

## GDScript 源码复刻

`run()` 同时走资源存在和资源缺失两条路径：成功时从同一份 PackedScene 创建两棵独立节点树，将第一棵加入 SceneTree，并记录 enter-tree/READY 顺序；加载失败时返回空值，不得改动 `current_scene`.

`src/source_replay.gd` 按本课列出的 C++ 入口重建关键数据结构、条件分支和状态更新。它是可逐步阅读的教学移植，不是完整引擎替身；模型函数表会标明直接对应的源码行为和仅用于组织输入/输出的脚手架。平台、线程、对象分配和服务器副作用仍由真实引擎处理。

| 模型函数 | C++ 源码对照或脚手架性质 | 复现的状态与分支 |
| --- | --- | --- |
| `_load_scene()` | `Main::start / ResourceLoader::load` | 模拟 ResourceLoader 按路径返回场景资源。 |
| `_packed_scene_instance()` | `PackedScene::instance` | 从 PackedScene 创建新的场景节点实例。 |
| `_install_scene()` | `SceneTree::set_current_scene / SceneTree::init` | 设置当前场景，并区分 enter-tree 与 READY 顺序。 |

## 最小 Godot/GDScript 实验

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

## 下一课

继续阅读 [s05_main_iteration](../s05_main_iteration/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
