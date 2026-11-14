# 第 4 课：`MainLoop` 与 `SceneTree` 的创建和启动

**目标：** 追踪 Godot 4.7 `Main::start()` 如何决定项目主场景和 `MainLoop` 类型、创建 `SceneTree`、实例化主场景并交给平台运行。

## 本课增量

把主场景资源、PackedScene 实例、SceneTree root/current_scene 和节点进入/READY 通知接成完整路径。

## 本课问题

`application/run/main_scene` 什么时候选为启动路径？`MainLoop` 如何由 ClassDB 创建？SceneTree 的当前场景何时挂到 root？

## 源码调用链

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

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-4.7` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [摘录](src/upstream/main/main.cpp.excerpt) | `engine/godot-4.7/main/main.cpp` | 4013-4013, 4335-4346, 4360-4438 |
| 2 | [node.cpp](src/upstream/scene/main/node.cpp) | [摘录](src/upstream/scene/main/node.cpp.excerpt) | `engine/godot-4.7/scene/main/node.cpp` | 3868-3868 |
| 3 | [scene_tree.cpp](src/upstream/scene/main/scene_tree.cpp) | [摘录](src/upstream/scene/main/scene_tree.cpp.excerpt) | `engine/godot-4.7/scene/main/scene_tree.cpp` | 586-591, 1954-1954 |

## GDScript 源码复刻与 C++ 对照

模型把 PackedScene 资源和实例节点分开，展示本代文件格式与 instance()/instantiate() 差异，并记录 enter-tree 和 READY 顺序。

src/upstream/ 保存本课引用的完整上游文件副本和带原始行号的摘录；src/source_replay.gd 执行表中的教学模型。先观察模型如何改变状态或走分支，再回到对应 C++ 函数核对。模型不替代 C++，也不代表引擎运行时本身。

| C++ 追踪阶段 | 模型函数 | 运行时要观察什么 |
| --- | --- | --- |
| project main scene / ResourceLoader | _resource_load() | 读出本代工程格式下的 PackedScene 描述 |
| PackedScene::instance/instantiate | _packed_scene_instance() | 分离资源身份和新节点实例 |
| MainLoop::initialize / SceneTree current scene | _install_main_loop() | 记录 enter-tree 父先、READY 子先顺序 |

独立项目入口先调用 source_replay.gd，再执行真实 Godot API 实验。实验脚本：start_probe.gd。模型输出是确定性的教学数据；只有实际用对应版本 Godot 运行后，才能记录为引擎实验验证。
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
