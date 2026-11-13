# 第 3 课：`Main::setup2()` 与场景/服务器注册

**目标：** 追踪 Godot 1.1 第二阶段启动如何初始化 OS、注册核心单例、场景与服务器类型、GDScript 语言，并在最小场景中调用 `VisualServer` 的公开统计接口。

## 本课问题

`setup2()` 如何接续 `setup()`？`register_server_types()` 注册了什么？为什么主场景脚本能够访问 `VisualServer`？

## C++ 源码追踪

以下路径相对于 `engine/godot-1.1/` 快照根目录：

- `main/main.cpp:778-784`：`Main::setup2()` 初始化 OS，再调用 `register_core_singletons()`。
- `main/main.cpp:792-835`：从已加载的 Globals 设置启动图像、清屏色和应用图标；这是使用先前读取项目设置的阶段。
- `main/main.cpp:837-856`：加载 remap，依次调用 `register_scene_types()`、`register_server_types()`，然后注册模块/驱动并初始化脚本语言。
- `servers/register_server_types.cpp:39-66`：把 `VisualServer`、音频和物理服务放入 `Globals` 单例表，并注册服务相关对象类型。
- `servers/visual_server.cpp:562`、`689-695`：绑定 `VisualServer.get_render_info()` 及 `INFO_OBJECTS_IN_FRAME` 等常量。
- `main/main.cpp:869-874`：所有阶段成功后设置启动成功标志并返回；平台随后进入 `Main::start()`。

调用摘要：`Main::setup()` 已载入项目设置 → `setup2()` 初始化 OS/核心单例 → 注册场景和服务器类型 → 注册模块/驱动 → 初始化 GDScript 与翻译服务。项目设置的读取发生在 S02 追踪的 `setup()`，本课观察 `setup2()` 如何使用其配置并准备服务。

## 最小实验

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
