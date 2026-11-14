# 第 3 课：ClassDB 注册及服务器初始化

**目标：** 追踪 Godot 3.6 `Main::setup2()` 如何分阶段注册服务器类型、场景类型和单例，再通过最小 GDScript 查询 ClassDB 与 `VisualServer`。

## 本课增量

把类型注册和脚本单例发布拆成两张表，按本代 setup2 顺序填充代表类与服务器服务。

**本课要回答：** `ClassDB` 注册类型与 `Engine` 注册脚本单例分别发生在哪里？物理/导航初始化和服务器单例发布的次序如何？

## C++ 源码追踪

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

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [core_bind.cpp](src/upstream/core/bind/core_bind.cpp) | [2949-2950](src/upstream/core/bind/core_bind.cpp.excerpt) | engine/godot-3.6/core/bind/core_bind.cpp |
| 2 | [main.cpp](src/upstream/main/main.cpp) | [1422-1477 ; 1501-1506 ; 1615-1633 ; 1648-1657](src/upstream/main/main.cpp.excerpt) | engine/godot-3.6/main/main.cpp |
| 3 | [register_server_types.cpp](src/upstream/servers/register_server_types.cpp) | [110-124 ; 211-220](src/upstream/servers/register_server_types.cpp.excerpt) | engine/godot-3.6/servers/register_server_types.cpp |
| 4 | [visual_server.cpp](src/upstream/servers/visual_server.cpp) | [2286-2286](src/upstream/servers/visual_server.cpp.excerpt) | engine/godot-3.6/servers/visual_server.cpp |

## GDScript 源码复刻

`src/source_replay.gd` 按本课列出的 C++ 入口重建关键数据结构、条件分支和状态更新。它是可逐步阅读的教学移植，不是完整引擎替身；模型函数表会标明直接对应的源码行为和仅用于组织输入/输出的脚手架。平台、线程、对象分配和服务器副作用仍由真实引擎处理。

| 模型函数 | C++ 源码对照或脚手架性质 | 复现的状态与分支 |
| --- | --- | --- |
| `_register_class()` | `ClassDB::register_class / register_server_types` | 登记 ClassDB 类型、继承和创建元数据。 |
| `_publish()` | `register_server_singletons / Engine::add_singleton` | 将已初始化的服务对象发布到 Globals/Engine 单例表。 |
| `_stage()` | `教学脚手架：按 Main::setup2 摘录记录阶段，不对应单一 C++ 函数` | 只记下模型步骤；类型注册与单例发布分别由上一行、上上行的模型函数处理。 |

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
