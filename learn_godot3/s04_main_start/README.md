# 第 4 课：`Main::start()`、主场景装载与 `SceneTree` 创建

**目标：** 追踪 Godot 3.6 `Main::start()` 如何决定主循环类型、使用项目主场景、实例化 `PackedScene` 并把它设为当前场景。

## 本课增量

把主场景资源、PackedScene 实例、SceneTree root/current_scene 和节点进入/READY 通知接成完整路径。

## 本课问题

项目主场景配置何时参与启动？默认 `MainLoop` 类型是什么？场景实例与 OS 主循环分别在哪一步交接？

## 源码调用链

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

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-3.6` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [摘录](src/upstream/main/main.cpp.excerpt) | `engine/godot-3.6/main/main.cpp` | 1682-1682, 1859-1867, 1927-1948 |
| 2 | [node.cpp](src/upstream/scene/main/node.cpp) | [摘录](src/upstream/scene/main/node.cpp.excerpt) | `engine/godot-3.6/scene/main/node.cpp` | 3132-3132 |
| 3 | [scene_tree.cpp](src/upstream/scene/main/scene_tree.cpp) | [摘录](src/upstream/scene/main/scene_tree.cpp.excerpt) | `engine/godot-3.6/scene/main/scene_tree.cpp` | 521-525, 2119-2119 |

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
