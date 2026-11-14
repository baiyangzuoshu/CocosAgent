# 第 4 课：`Main::start()` 装载主场景与创建主循环

**目标：** 追踪 Godot 1.1 `Main::start()` 如何选择项目主场景、创建 `SceneTree`、实例化 `PackedScene` 并把它设为当前场景，再将主循环交给 OS。

## 本课增量

把主场景资源、PackedScene 实例、SceneTree root/current_scene 和节点进入/READY 通知接成完整路径。

## 本课问题

没有命令行场景路径时，主场景从哪里来？`PackedScene` 如何变成当前场景 Node？`SceneTree` 何时把已添加的场景接入树并触发 `_ready()`？

## 源码调用链

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

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-1.1` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [摘录](src/upstream/main/main.cpp.excerpt) | `engine/godot-1.1/main/main.cpp` | 880-880, 993-1001, 1244-1252, 1299-1301 |
| 2 | [node.cpp](src/upstream/scene/main/node.cpp) | [摘录](src/upstream/scene/main/node.cpp.excerpt) | `engine/godot-1.1/scene/main/node.cpp` | 1850-1850 |
| 3 | [scene_main_loop.cpp](src/upstream/scene/main/scene_main_loop.cpp) | [摘录](src/upstream/scene/main/scene_main_loop.cpp.excerpt) | `engine/godot-1.1/scene/main/scene_main_loop.cpp` | 465-477, 1042-1045, 1098-1098 |

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
