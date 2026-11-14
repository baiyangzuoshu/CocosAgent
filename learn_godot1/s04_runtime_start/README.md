# 第 4 课：`Main::start()` 装载主场景与创建主循环

**目标：** 追踪 Godot 1.1 `Main::start()` 如何选择项目主场景、创建 `SceneTree`、实例化 `PackedScene` 并把它设为当前场景，再将主循环交给 OS。

## 本课增量

把主场景资源、PackedScene 实例、SceneTree root/current_scene 和节点进入/READY 通知接成完整路径。

**本课要回答：** 没有命令行场景路径时，主场景从哪里来？`PackedScene` 如何变成当前场景 Node？`SceneTree` 何时把已添加的场景接入树并触发 `_ready()`？

## C++ 源码追踪

源码依据：`engine/godot-1.1/`（Godot 1.1 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-1.1/` 快照根目录：

- `main/main.cpp:880`：`Main::start()` 作为 `setup()` / `setup2()` 之后的启动阶段入口。
- `main/main.cpp:993-1001`、`1171-1186`：没有脚本或命令行场景时读取 `application/main_scene`；没有自定义主循环类型时实例化 `SceneTree`。
- `main/main.cpp:1244-1252`：加载 `PackedScene`，调用 `instance()`，再通过 `SceneTree::add_current_scene()` 设为当前场景并加入 root。
- `scene/main/scene_main_loop.cpp:1042-1045`：`add_current_scene()` 先更新 `current_scene`，再把 Node 加到 SceneTree root。
- `main/main.cpp:1299-1301`、`scene/main/scene_main_loop.cpp:465-477`：把主循环交给 OS；SceneTree 初始化时将 root 接入树并调用 `MainLoop::init()`。
- `scene/main/node.cpp:1850`、`scene/main/scene_main_loop.cpp:1098`：脚本可通过 `get_tree().get_current_scene()` 读取当前场景。

调用摘要：项目设置提供 `application/main_scene` → `Main::start()` 选择默认 `SceneTree` → `ResourceLoader` 加载并实例化 `PackedScene` → 加入树并设置当前场景 → OS 持有主循环 → SceneTree 初始化 root。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [880-880 ; 993-1001 ; 1244-1252 ; 1299-1301](src/upstream/main/main.cpp.excerpt) | engine/godot-1.1/main/main.cpp |
| 2 | [node.cpp](src/upstream/scene/main/node.cpp) | [1850-1850](src/upstream/scene/main/node.cpp.excerpt) | engine/godot-1.1/scene/main/node.cpp |
| 3 | [scene_main_loop.cpp](src/upstream/scene/main/scene_main_loop.cpp) | [465-477 ; 1042-1045 ; 1098-1098](src/upstream/scene/main/scene_main_loop.cpp.excerpt) | engine/godot-1.1/scene/main/scene_main_loop.cpp |

## GDScript 源码复刻

`run()` 同时走资源存在和资源缺失两条路径：成功时从同一份 PackedScene 创建两棵独立节点树，将第一棵加入 SceneTree，并记录 enter-tree/READY 顺序；加载失败时返回空值，不得改动 `current_scene`.

`src/source_replay.gd` 按本课列出的 C++ 入口重建关键数据结构、条件分支和状态更新。它是可逐步阅读的教学移植，不是完整引擎替身；模型函数表会标明直接对应的源码行为和仅用于组织输入/输出的脚手架。平台、线程、对象分配和服务器副作用仍由真实引擎处理。

| 模型函数 | C++ 源码对照或脚手架性质 | 复现的状态与分支 |
| --- | --- | --- |
| `_load_main_scene()` | `Main::start / ResourceLoader::load` | 按项目主场景路径模拟 ResourceLoader 返回的 PackedScene。 |
| `_instance_packed_scene()` | `PackedScene::instance` | 从共享场景资源创建独立节点实例；资源加载失败时返回空值并阻止安装。 |
| `_install_scene_tree()` | `SceneTree::add_current_scene / SceneTree::init` | 仅对成功实例设置当前场景，并演示 parent-first enter-tree 与 child-first READY 顺序。 |

## 最小 Godot/GDScript 实验

- `engine.cfg`：指定 `main.xml` 为项目主场景。
- `main.xml`：Godot 1.1 XML `PackedScene`，root Node 挂接脚本。
- `start_probe.gd`：在 `_ready()` 读取 `get_tree().get_current_scene().name`。

在本目录运行：

```sh
godot -path .
```

预期输出 `S04MainScene`。这表明 `_ready()` 执行时 SceneTree 的当前场景已是项目主场景；场景选择与实例化过程由 C++ 源码确认。

## 简化与边界

本实验不传入命令行场景覆盖路径，也不配置自定义 `MainLoop`、autoload 或编辑器模式，只观察项目配置指定的默认主场景。Godot 1.1 的 `SceneTree`、XML `PackedScene` 与 `instance()` 是本代实现；本文尚未运行项目。

## 下一课

继续阅读 [s05_main_iteration](../s05_main_iteration/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
