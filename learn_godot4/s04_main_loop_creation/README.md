# 第 4 课：`MainLoop` 与 `SceneTree` 的创建和启动

**目标：** 追踪 Godot 4.7 `Main::start()` 如何决定项目主场景和 `MainLoop` 类型、创建 `SceneTree`、实例化主场景并交给平台运行。

## 本课增量

把主场景资源、PackedScene 实例、SceneTree root/current_scene 和节点进入/READY 通知接成完整路径。

**本课要回答：** `application/run/main_scene` 什么时候选为启动路径？`MainLoop` 如何由 ClassDB 创建？SceneTree 的当前场景何时挂到 root？

## C++ 源码追踪

源码依据：`engine/godot-4.7/`（Godot 4.7 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-4.7/` 快照根目录：

- `main/main.cpp:4013`：`Main::start()` 进入启动阶段。
- `main/main.cpp:4335-4346`：没有显式脚本或场景路径时，读取 `application/run/main_scene`；快照也处理基于 UID 的主场景路径。
- `main/main.cpp:4360-4438`：从项目设置取得 `application/run/main_loop_type`，默认值为空时改用 `SceneTree`；ClassDB 实例化主循环并交给 OS。
- `main/main.cpp:4753-4768`：加载项目场景资源，通过 `PackedScene::instantiate()` 创建 Node，再调用 `SceneTree::add_current_scene()`。
- `scene/main/scene_tree.cpp:586-591`、`1762-1765`：SceneTree 初始化 root 并将当前场景挂到 root。
- `scene/main/node.cpp:3868`、`scene/main/scene_tree.cpp:1954`、`1975`：GDScript 可通过 `get_tree().get_current_scene()` 读取当前场景。

调用摘要：确定主场景路径 → 创建 `MainLoop`（默认 `SceneTree`）并交给 OS → 加载/实例化 PackedScene → 设置当前场景并挂到 root → 平台调用 SceneTree 初始化。S01 追踪的平台回调负责在 `Main::start()` 返回后初始化主循环；本课聚焦主循环和场景对象的构造。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [4013-4013 ; 4335-4346 ; 4360-4438 ; 4753-4768](src/upstream/main/main.cpp.excerpt) | engine/godot-4.7/main/main.cpp |
| 2 | [node.cpp](src/upstream/scene/main/node.cpp) | [3868-3868](src/upstream/scene/main/node.cpp.excerpt) | engine/godot-4.7/scene/main/node.cpp |
| 3 | [scene_tree.cpp](src/upstream/scene/main/scene_tree.cpp) | [586-591 ; 1954-1954](src/upstream/scene/main/scene_tree.cpp.excerpt) | engine/godot-4.7/scene/main/scene_tree.cpp |

## GDScript 源码复刻

`run()` 同时走资源存在和资源缺失两条路径：成功时从同一份 PackedScene 创建两棵独立节点树，将第一棵加入 SceneTree，并记录 enter-tree/READY 顺序；加载失败时返回空值，不得改动 `current_scene`.

`src/source_replay.gd` 按本课列出的 C++ 入口重建关键数据结构、条件分支和状态更新。它是可逐步阅读的教学移植，不是完整引擎替身；模型函数表会标明直接对应的源码行为和仅用于组织输入/输出的脚手架。平台、线程、对象分配和服务器副作用仍由真实引擎处理。

| 模型函数 | C++ 源码对照或脚手架性质 | 复现的状态与分支 |
| --- | --- | --- |
| `_load_main_scene()` | `Main::start / ResourceLoader::load` | 按项目主场景路径模拟 ResourceLoader 返回的 PackedScene。 |
| `_instantiate()` | `PackedScene::instantiate` | 将 PackedScene 资源实例化为新的 Node 树。 |
| `_set_current_scene()` | `SceneTree::set_current_scene / SceneTree::initialize` | 先设置当前场景，再把实例接入 SceneTree root。 |

## 最小 Godot/GDScript 实验

- `project.godot`：Godot 4.7 项目配置，版本 5，指定 `main.tscn`。
- `main.tscn`：format 3 文本场景，root Node 挂接脚本。
- `start_probe.gd`：在 `_ready()` 打印 `get_tree().get_current_scene().name`。

从本目录运行：

```sh
godot
```

预期输出 `S04MainScene`。这说明场景进入运行树后，脚本能读取 `SceneTree.current_scene`；脚本不重建 `Main::start()` 的 C++ 行为。

## 简化与边界

实验使用当前目录中的项目配置和默认 `SceneTree`，不传命令行覆盖路径，不处理脚本型 MainLoop、编辑器或自定义运行工具。Godot 4.7 的 `instantiate()`、ClassDB 和 SceneTree 初始化顺序不外推到旧代。本课依据静态源码，尚未运行。

## 下一课

继续阅读 [s05_main_iteration](../s05_main_iteration/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
