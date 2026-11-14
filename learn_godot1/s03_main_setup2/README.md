# 第 3 课：`Main::setup2()` 与场景/服务器注册

**目标：** 追踪 Godot 1.1 第二阶段启动如何初始化 OS、注册核心单例、场景与服务器类型、GDScript 语言，并在最小场景中调用 `VisualServer` 的公开统计接口。

## 本课问题

`setup2()` 如何接续 `setup()`？`register_server_types()` 注册了什么？为什么主场景脚本能够访问 `VisualServer`？

## 源码调用链

源码依据：`engine/godot-1.1/`（Godot 1.1 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-1.1/` 快照根目录：

- `main/main.cpp:778-784`：`Main::setup2()` 初始化 OS，再调用 `register_core_singletons()`。
- `main/main.cpp:792-835`：从已加载的 Globals 设置启动图像、清屏色和应用图标；这是使用先前读取项目设置的阶段。
- `main/main.cpp:837-856`：加载 remap，依次调用 `register_scene_types()`、`register_server_types()`，然后注册模块/驱动并初始化脚本语言。
- `servers/register_server_types.cpp:39-66`：把 `VisualServer`、音频和物理服务放入 `Globals` 单例表，并注册服务相关对象类型。
- `servers/visual_server.cpp:562`、`689-695`：绑定 `VisualServer.get_render_info()` 及 `INFO_OBJECTS_IN_FRAME` 等常量。
- `main/main.cpp:869-874`：所有阶段成功后设置启动成功标志并返回；平台随后进入 `Main::start()`。

调用摘要：`Main::setup()` 已载入项目设置 → `setup2()` 初始化 OS/核心单例 → 注册场景和服务器类型 → 注册模块/驱动 → 初始化 GDScript 与翻译服务。项目设置的读取发生在 S02 追踪的 `setup()`，本课观察 `setup2()` 如何使用其配置并准备服务。

## 本课源码复刻

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-1.1` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [摘录](src/upstream/main/main.cpp.excerpt) | `engine/godot-1.1/main/main.cpp` | 778-784, 792-835 |
| 2 | [register_server_types.cpp](src/upstream/servers/register_server_types.cpp) | [摘录](src/upstream/servers/register_server_types.cpp.excerpt) | `engine/godot-1.1/servers/register_server_types.cpp` | 39-66 |
| 3 | [visual_server.cpp](src/upstream/servers/visual_server.cpp) | [摘录](src/upstream/servers/visual_server.cpp.excerpt) | `engine/godot-1.1/servers/visual_server.cpp` | 562-562 |

## 可运行源码复刻

课程代码 [`src/source_replay.gd`](src/source_replay.gd) 按本课 C++ 函数关系实现一个小型 GDScript 模型；入口脚本会先运行它，再执行下面的真实引擎 API 实验。阅读时把模型中的状态变化逐步映射到上方的 C++ 摘录。模型只复刻本课选出的路径，不声称等同于完整 Godot 引擎。

## 最小 Godot/GDScript 实验

- `engine.cfg`：设置主场景 `main.xml`。
- `main.xml`：Godot 1.1 XML `PackedScene`，包含一个挂脚本的 Node。
- `server_probe.gd`：在 `_ready()` 调用 `VisualServer.get_render_info()`，读取当前帧对象数。

在本目录运行：

```sh
godot -path .
```

预期输出 `INFO_OBJECTS_IN_FRAME` 对应的整数。该调用说明脚本启动时可访问已注册的 `VisualServer` 单例和绑定方法；计数值取决于实际渲染帧与后端。

## 简化与边界

只追踪桌面项目运行中与场景、服务器、GDScript 相关的第二阶段顺序，不涵盖编辑器专有类型、其他平台分支或每个服务的内部实现。Godot 1.1 的项目设置在 `setup()` 中读取；不能把这一职责改写成由 `setup2()` 首次加载。本课为静态源码追踪，项目尚未运行。

## 下一课

继续阅读 [s04_runtime_start](../s04_runtime_start/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
