# 第 3 课：引擎类型注册与服务器初始化

**目标：** 追踪 Godot 4.7 `Main::setup2()` 中服务器类注册、场景类注册和服务单例发布的阶段顺序，并用 GDScript 检查公开类型和渲染服务。

## 本课问题

服务器类何时进入 ClassDB？`RenderingServer` 单例又何时对脚本发布？物理/导航初始化与场景注册之间的边界是什么？

## C++ 源码追踪

以下路径相对于 `engine/godot-4.7/` 快照根目录：

- `main/main.cpp:1016-1032`：源码将初始化划分为 `setup()`、`setup2()`、`start()`；其中 `setup2()` 注册高层服务器、单例和场景/编辑器类型。
- `main/main.cpp:3033-3041`：`Main::setup2()` 启动第二阶段并建立阶段统计。
- `main/main.cpp:3212-3229`、`servers/register_server_types.cpp:146-170`：创建导航服务管理器并调用 `register_server_types()`，后者把服务类注册到 ClassDB 并注册 TextServerManager 等单例。
- `main/main.cpp:3776-3795`：初始化导航服务，注册场景类型和场景单例，再初始化场景级模块。
- `main/main.cpp:3858-3867`：创建相机服务、初始化物理服务，随后调用 `register_server_singletons()` 并初始化脚本语言。
- `servers/register_server_types.cpp:393-418`：将 RenderingServer、AudioServer、DisplayServer、PhysicsServer 等实例发布为 Engine 单例；具体项受编译选项控制。
- `servers/rendering/rendering_server.cpp:3511`、`3543-3545`：绑定 `get_rendering_info()` 与帧统计枚举；`core/core_bind.cpp:1599-1600`、`1842` 暴露 `ClassDB.class_exists()`。

调用摘要：服务类注册 → 场景类与场景单例注册 → 物理/导航服务初始化 → 发布服务器单例 → 初始化脚本语言。ClassDB 注册类型与 Engine 发布服务实例是两个不同阶段。

## 最小实验

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

## 本课 C++ 源码摘录

课内摘录保留对应 Godot 源码行段正文，并在段首标出原始行号；完整上下文以只读的 engine 快照为准。摘录用于追踪，不是独立编译单元。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | Godot 源文件 | 上游行段 |
| --- | --- | --- |
| [core_bind.cpp](src/upstream/core/core_bind.cpp.excerpt) | godot-4.7/core/core_bind.cpp | 1599-1600 |
| [main.cpp](src/upstream/main/main.cpp.excerpt) | godot-4.7/main/main.cpp | 1016-1032, 3033-3041, 3212-3229, 3776-3795, 3858-3867 |
| [register_server_types.cpp](src/upstream/servers/register_server_types.cpp.excerpt) | godot-4.7/servers/register_server_types.cpp | 146-170, 393-418 |
| [rendering_server.cpp](src/upstream/servers/rendering/rendering_server.cpp.excerpt) | godot-4.7/servers/rendering/rendering_server.cpp | 3511-3511 |
