# 第 4 课：`Main::start()`、主场景装载与主循环创建

**目标：** 追踪 Godot 2.1 `Main::start()` 如何读取默认主场景、创建 `SceneTree`、实例化场景并设置当前场景，再把主循环交给 OS。

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

## 可运行源码复刻

课程代码 [`src/source_replay.gd`](src/source_replay.gd) 按本课 C++ 函数关系实现一个小型 GDScript 模型；入口脚本会先运行它，再执行下面的真实引擎 API 实验。阅读时把模型中的状态变化逐步映射到上方的 C++ 摘录。模型只复刻本课选出的路径，不声称等同于完整 Godot 引擎。

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
