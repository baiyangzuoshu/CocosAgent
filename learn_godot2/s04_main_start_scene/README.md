# 第 4 课：`Main::start()`、主场景装载与主循环创建

**目标：** 追踪 Godot 2.1 `Main::start()` 如何读取默认主场景、创建 `SceneTree`、实例化场景并设置当前场景，再把主循环交给 OS。

## 本课增量

把主场景资源、PackedScene 实例、SceneTree root/current_scene 和节点进入/READY 通知接成完整路径。

**本课要回答：** `application/main_scene` 在什么时候成为待加载路径？`MainLoop` 类型和 `SceneTree` 有什么关系？主场景何时进入 root？

## C++ 源码追踪

源码依据：`engine/godot-2.1/`（Godot 2.1 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-2.1/` 快照根目录：

- `main/main.cpp:1010`：`Main::start()` 是项目运行阶段入口。
- `main/main.cpp:1124-1130`、`1171-1186`：没有脚本或命令行路径时读取 `application/main_scene`；`application/main_loop_type` 未配置时默认创建 `SceneTree`。
- `main/main.cpp:1420-1428`：`ResourceLoader::load()` 读取场景资源，`PackedScene::instance()` 创建 Node，`SceneTree::add_current_scene()` 设置当前场景并加入 root。
- `scene/main/scene_main_loop.cpp:1042-1045`：`add_current_scene()` 记录 `current_scene` 后把 Node 加入 SceneTree。
- `main/main.cpp:1478-1480`、`scene/main/scene_main_loop.cpp:461-470`：把主循环交给 OS；SceneTree 初始化时连接 root 并调用 `MainLoop::init()`。
- `scene/main/node.cpp:2126`、`scene/main/scene_main_loop.cpp:1592`：GDScript 可通过 `get_tree().get_current_scene()` 读取当前场景。

调用摘要：读取项目主场景 → 创建/选择 `MainLoop` → 场景资源加载与 `instance()` → 设为当前场景并加入 root → OS 接管主循环 → SceneTree 初始化。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [1010-1010 ; 1124-1130 ; 1420-1428 ; 1478-1480](src/upstream/main/main.cpp.excerpt) | engine/godot-2.1/main/main.cpp |
| 2 | [node.cpp](src/upstream/scene/main/node.cpp) | [2126-2126](src/upstream/scene/main/node.cpp.excerpt) | engine/godot-2.1/scene/main/node.cpp |
| 3 | [scene_main_loop.cpp](src/upstream/scene/main/scene_main_loop.cpp) | [461-470 ; 1042-1045 ; 1592-1592](src/upstream/scene/main/scene_main_loop.cpp.excerpt) | engine/godot-2.1/scene/main/scene_main_loop.cpp |

## GDScript 源码复刻

`run()` 同时走资源存在和资源缺失两条路径：成功时从同一份 PackedScene 创建两棵独立节点树，将第一棵加入 SceneTree，并记录 enter-tree/READY 顺序；加载失败时返回空值，不得改动 `current_scene`.

`src/source_replay.gd` 按本课列出的 C++ 入口重建关键数据结构、条件分支和状态更新。它是可逐步阅读的教学移植，不是完整引擎替身；模型函数表会标明直接对应的源码行为和仅用于组织输入/输出的脚手架。平台、线程、对象分配和服务器副作用仍由真实引擎处理。

| 模型函数 | C++ 源码对照或脚手架性质 | 复现的状态与分支 |
| --- | --- | --- |
| `_load_main_scene()` | `Main::start / ResourceLoader::load` | 按项目主场景路径模拟 ResourceLoader 返回的 PackedScene。 |
| `_packed_scene_instance()` | `PackedScene::instance` | 从 PackedScene 创建新的场景节点实例。 |
| `_install_current_scene()` | `SceneTree::add_current_scene / SceneTree::init` | 仅在实例非空时更新 SceneTree.current_scene 并连接到 root；缺失场景不改变现有树状态。 |

## 最小 Godot/GDScript 实验

- `engine.cfg`：Godot 2.1 项目配置，指定主场景 `main.tscn`。
- `main.tscn`：format 1 文本 `PackedScene`，root Node 挂接脚本。
- `start_probe.gd`：在 `_ready()` 打印 `get_tree().get_current_scene().name`。

在本目录运行：

```sh
godot -path .
```

预期输出 `S04MainScene`。脚本观察的是 SceneTree 已发布的当前场景；资源选择、加载和实例化顺序以 C++ 快照为证。

## 简化与边界

只走 `engine.cfg` 指定的默认主场景，不覆盖命令行场景参数、自定义 MainLoop、编辑器或 Project Manager 路径。Godot 2.1 使用 `PackedScene::instance()` 和 format 1 场景；本课尚未用旧版工具运行。

## 下一课

继续阅读 [s05_main_iteration](../s05_main_iteration/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
