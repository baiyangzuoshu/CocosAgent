# 第 3 课：ClassDB 注册及服务器初始化

**目标：** 追踪 Godot 3.6 `Main::setup2()` 如何分阶段注册服务器类型、场景类型和单例，再通过最小 GDScript 查询 ClassDB 与 `VisualServer`。

## 本课增量

把类型注册和脚本单例发布拆成两张表，按本代 setup2 顺序填充代表类与服务器服务。

## 本课问题

`ClassDB` 注册类型与 `Engine` 注册脚本单例分别发生在哪里？物理/导航初始化和服务器单例发布的次序如何？

## 源码调用链

源码依据：`engine/godot-3.6/`（Godot 3.6 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-3.6/` 快照根目录：

- `main/main.cpp:1422-1477`：进入 `setup2()` 后初始化平台 OS、音频/ARVR 服务并注册核心单例。
- `main/main.cpp:1501-1506`、`servers/register_server_types.cpp:110-124`：注册服务器相关的 ClassDB 类型；主流程随后通过 `VisualServer` 设置默认清屏色。
- `main/main.cpp:1615-1633`：注册场景类型和模块，并初始化主题等依赖。
- `main/main.cpp:1648-1657`：创建相机服务，初始化物理/导航服务，再调用 `register_server_singletons()` 和 `ScriptServer::init_languages()`。
- `servers/register_server_types.cpp:211-220`：将 `VisualServer`、物理、音频、导航等对象分别添加为 Engine 单例。
- `servers/visual_server.cpp:2286`、`2513-2516`：绑定 `get_render_info()` 与帧统计常量；`core/bind/core_bind.cpp:2949-2950`、`3119` 提供 GDScript 可用的 `ClassDB.class_exists()`。

调用摘要：`setup2()` 初始化平台服务 → 注册服务类 → 注册场景类 → 初始化物理/导航 → 发布服务器单例 → 初始化脚本语言。ClassDB 类型存在，不等于一个服务单例已发布；源码分别处理这两件事。

## 本课源码复刻

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-3.6` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [core_bind.cpp](src/upstream/core/bind/core_bind.cpp) | [摘录](src/upstream/core/bind/core_bind.cpp.excerpt) | `engine/godot-3.6/core/bind/core_bind.cpp` | 2949-2950 |
| 2 | [main.cpp](src/upstream/main/main.cpp) | [摘录](src/upstream/main/main.cpp.excerpt) | `engine/godot-3.6/main/main.cpp` | 1422-1477 |
| 3 | [register_server_types.cpp](src/upstream/servers/register_server_types.cpp) | [摘录](src/upstream/servers/register_server_types.cpp.excerpt) | `engine/godot-3.6/servers/register_server_types.cpp` | 110-124, 211-220 |
| 4 | [visual_server.cpp](src/upstream/servers/visual_server.cpp) | [摘录](src/upstream/servers/visual_server.cpp.excerpt) | `engine/godot-3.6/servers/visual_server.cpp` | 2286-2286 |

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

- `project.godot`：Godot 3.6 项目配置，版本 4。
- `main.tscn`：format 2 文本场景。
- `server_probe.gd`：检查 `Node2D` / `VisualServer` 类型，并读取帧对象数。

在本目录运行：

```sh
godot --path .
```

预期两项 `ClassDB.class_exists()` 都为真，随后打印 `VisualServer` 的帧对象数整数。计数取决于当前渲染帧与后端；这些脚本输出只验证公开接口能被调用。

## 简化与边界

只比较一个基础场景类和一个服务器类，并读取一项统计；没有检查每个条件编译分支或平台后端。Godot 3.6 保留 `VisualServer` / `ClassDB` 命名，不外推为 Godot 4 的注册时序。本课尚未运行。

## 下一课

继续阅读 [s04_main_start](../s04_main_start/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
