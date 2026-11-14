# 第 3 课：类型注册、单例和服务器初始化

**目标：** 追踪 Godot 2.1 `Main::setup2()` 中 OS 初始化、核心单例注册、场景/服务器类型注册和脚本语言准备，并通过 `VisualServer` 观察服务 API。

## 本课问题

`setup2()` 在 `setup()` 之后补上哪些初始化？`ObjectTypeDB` 类型注册与 `Globals` 单例注册有何区别？GDScript 何时能调用服务器方法？

## 源码调用链

源码依据：`engine/godot-2.1/`（Godot 2.1 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-2.1/` 快照根目录：

- `main/main.cpp:869-884`：`Main::setup2()` 初始化 OS 和窗口状态，再注册核心单例。
- `main/main.cpp:904-973`：加载 remap 和启动图像后，调用 `register_scene_types()`、`register_server_types()`。
- `servers/register_server_types.cpp:59-86`：服务器注册函数向 `Globals` 增加 `VisualServer`、`AudioServer`、`PhysicsServer` 等单例，并注册查询/碰撞相关的 `ObjectTypeDB` 类型。
- `main/main.cpp:983-1007`：注册模块与驱动、初始化脚本语言和翻译服务，成功后置位 `_start_success`。
- `servers/visual_server.cpp:541`、`663-668`：把 `get_render_info()` 和 `INFO_OBJECTS_IN_FRAME` 等常量暴露到脚本接口。
- `servers/visual_server.h:1100-1114`：定义渲染统计枚举和对应的虚接口。

调用摘要：平台完成 `setup()` → `setup2()` 初始化 OS → 注册 core/scene/server → 注册 modules/drivers → 初始化 GDScript。`register_server_types()` 同时将服务器对象挂到 `Globals` 并注册相应类型；两种注册影响不同。

## 本课源码复刻

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-2.1` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [摘录](src/upstream/main/main.cpp.excerpt) | `engine/godot-2.1/main/main.cpp` | 869-884, 904-973 |
| 2 | [register_server_types.cpp](src/upstream/servers/register_server_types.cpp) | [摘录](src/upstream/servers/register_server_types.cpp.excerpt) | `engine/godot-2.1/servers/register_server_types.cpp` | 59-86 |
| 3 | [visual_server.cpp](src/upstream/servers/visual_server.cpp) | [摘录](src/upstream/servers/visual_server.cpp.excerpt) | `engine/godot-2.1/servers/visual_server.cpp` | 541-541 |
| 4 | [visual_server.h](src/upstream/servers/visual_server.h) | [摘录](src/upstream/servers/visual_server.h.excerpt) | `engine/godot-2.1/servers/visual_server.h` | 1100-1114 |

## 可运行源码复刻

课程代码 [`src/source_replay.gd`](src/source_replay.gd) 按本课 C++ 函数关系实现一个小型 GDScript 模型；入口脚本会先运行它，再执行下面的真实引擎 API 实验。阅读时把模型中的状态变化逐步映射到上方的 C++ 摘录。模型只复刻本课选出的路径，不声称等同于完整 Godot 引擎。

## 最小 Godot/GDScript 实验

- `engine.cfg`：Godot 2.1 项目和主场景配置。
- `main.tscn`：format 1 文本场景。
- `server_probe.gd`：在 `_ready()` 调用 `VisualServer.get_render_info(VisualServer.INFO_OBJECTS_IN_FRAME)`。

在本目录运行：

```sh
godot -path .
```

预期输出该统计项的整数。脚本在主场景启动时已能调用 `VisualServer`，可将它与 `setup2()` 中的注册顺序对照；该数值不保证大于零。

## 简化与边界

本课不展开每个服务的后端选择、线程模型和渲染提交，也不将 2.1 的 `Globals`/`ObjectTypeDB` 用新版本 `Engine`/`ClassDB` 术语替代。项目尚未用 Godot 2.1 工具运行，文中行为依据静态源码。

## 下一课

继续阅读 [s04_main_start_scene](../s04_main_start_scene/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
