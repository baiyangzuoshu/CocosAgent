# 第 4 课：`Main::start()`、主场景装载与主循环创建

**目标：** 追踪 Godot 2.1 `Main::start()` 如何读取默认主场景、创建 `SceneTree`、实例化场景并设置当前场景，再把主循环交给 OS。

## 本课增量

把主场景资源、PackedScene 实例、SceneTree root/current_scene 和节点进入/READY 通知接成完整路径。

## 本课问题

`application/main_scene` 在什么时候成为待加载路径？`MainLoop` 类型和 `SceneTree` 有什么关系？主场景何时进入 root？

## 源码调用链

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

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-2.1` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [摘录](src/upstream/main/main.cpp.excerpt) | `engine/godot-2.1/main/main.cpp` | 1010-1010, 1124-1130, 1420-1428, 1478-1480 |
| 2 | [node.cpp](src/upstream/scene/main/node.cpp) | [摘录](src/upstream/scene/main/node.cpp.excerpt) | `engine/godot-2.1/scene/main/node.cpp` | 2126-2126 |
| 3 | [scene_main_loop.cpp](src/upstream/scene/main/scene_main_loop.cpp) | [摘录](src/upstream/scene/main/scene_main_loop.cpp.excerpt) | `engine/godot-2.1/scene/main/scene_main_loop.cpp` | 461-470, 1042-1045, 1592-1592 |

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
