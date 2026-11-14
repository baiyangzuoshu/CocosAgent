# 第 3 课：引擎类型注册与服务器初始化

**目标：** 追踪 Godot 4.7 `Main::setup2()` 中服务器类注册、场景类注册和服务单例发布的阶段顺序，并用 GDScript 检查公开类型和渲染服务。

## 本课增量

把类型注册和脚本单例发布拆成两张表，按本代 setup2 顺序填充代表类与服务器服务。

## 本课问题

服务器类何时进入 ClassDB？`RenderingServer` 单例又何时对脚本发布？物理/导航初始化与场景注册之间的边界是什么？

## 源码调用链

源码依据：`engine/godot-4.7/`（Godot 4.7 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-4.7/` 快照根目录：

- `main/main.cpp:1016-1032`：源码将初始化划分为 `setup()`、`setup2()`、`start()`；其中 `setup2()` 注册高层服务器、单例和场景/编辑器类型。
- `main/main.cpp:3033-3041`：`Main::setup2()` 启动第二阶段并建立阶段统计。
- `main/main.cpp:3212-3229`、`servers/register_server_types.cpp:146-170`：创建导航服务管理器并调用 `register_server_types()`，后者把服务类注册到 ClassDB 并注册 TextServerManager 等单例。
- `main/main.cpp:3776-3795`：初始化导航服务，注册场景类型和场景单例，再初始化场景级模块。
- `main/main.cpp:3858-3867`：创建相机服务、初始化物理服务，随后调用 `register_server_singletons()` 并初始化脚本语言。
- `servers/register_server_types.cpp:393-418`：将 RenderingServer、AudioServer、DisplayServer、PhysicsServer 等实例发布为 Engine 单例；具体项受编译选项控制。
- `servers/rendering/rendering_server.cpp:3511`、`3543-3545`：绑定 `get_rendering_info()` 与帧统计枚举；`core/core_bind.cpp:1599-1600`、`1842` 暴露 `ClassDB.class_exists()`。

调用摘要：服务类注册 → 场景类与场景单例注册 → 物理/导航服务初始化 → 发布服务器单例 → 初始化脚本语言。ClassDB 注册类型与 Engine 发布服务实例是两个不同阶段。

## 本课源码复刻

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-4.7` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [core_bind.cpp](src/upstream/core/core_bind.cpp) | [摘录](src/upstream/core/core_bind.cpp.excerpt) | `engine/godot-4.7/core/core_bind.cpp` | 1599-1600 |
| 2 | [main.cpp](src/upstream/main/main.cpp) | [摘录](src/upstream/main/main.cpp.excerpt) | `engine/godot-4.7/main/main.cpp` | 1016-1032 |
| 3 | [register_server_types.cpp](src/upstream/servers/register_server_types.cpp) | [摘录](src/upstream/servers/register_server_types.cpp.excerpt) | `engine/godot-4.7/servers/register_server_types.cpp` | 146-170 |
| 4 | [rendering_server.cpp](src/upstream/servers/rendering/rendering_server.cpp) | [摘录](src/upstream/servers/rendering/rendering_server.cpp.excerpt) | `engine/godot-4.7/servers/rendering/rendering_server.cpp` | 3511-3511 |

## GDScript 源码复刻与 C++ 对照

模型维护类型表与脚本单例表，复现 ObjectTypeDB/Globals 与 ClassDB/Engine singleton 的分代差异；只登记本课追踪的代表项。

src/upstream/ 保存本课引用的完整上游文件副本和带原始行号的摘录；src/source_replay.gd 执行表中的教学模型。先观察模型如何改变状态或走分支，再回到对应 C++ 函数核对。模型不替代 C++，也不代表引擎运行时本身。

| C++ 追踪阶段 | 模型函数 | 运行时要观察什么 |
| --- | --- | --- |
| Main::setup2() | _stage() | 记录分代初始化阶段顺序 |
| register_server_types / register_scene_types | _register_class() / _publish() | 分别维护原生类型表和脚本单例表 |
| ScriptServer::init_languages() | _stage() | 脚本语言初始化晚于类型与服务准备 |

独立项目入口先调用 source_replay.gd，再执行真实 Godot API 实验。实验脚本：server_probe.gd。模型输出是确定性的教学数据；只有实际用对应版本 Godot 运行后，才能记录为引擎实验验证。
## 最小 Godot/GDScript 实验

- `project.godot`：Godot 4.7 项目配置，版本 5。
- `main.tscn`：format 3 文本场景。
- `server_probe.gd`：检查 `Node2D` / `RenderingServer` 类型，并读取渲染服务帧对象数。

从本目录运行：

```sh
godot
```

预期两项 `ClassDB.class_exists()` 都为真，随后输出 `RenderingServer` 的帧对象统计整数。计数值与渲染后端和当前帧有关；本实验只观察类型和服务 API 可用性。

## 简化与边界

本课只跟踪桌面项目的主要初始化顺序，省略各服务器后端创建细节、扩展初始化级别和禁用模块的编译分支。Godot 4 的 `RenderingServer`、`ClassDB` 和 `Engine` 注册方式不套用到旧版本。本课依据静态源码，未运行实验。

## 下一课

继续阅读 [s04_main_loop_creation](../s04_main_loop_creation/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
