# 第 3 课：ClassDB 注册及服务器初始化

**目标：** 追踪 Godot 3.6 `Main::setup2()` 如何分阶段注册服务器类型、场景类型和单例，再通过最小 GDScript 查询 ClassDB 与 `VisualServer`。

## 本课问题

`ClassDB` 注册类型与 `Engine` 注册脚本单例分别发生在哪里？物理/导航初始化和服务器单例发布的次序如何？

## C++ 源码追踪

以下路径相对于 `engine/godot-3.6/` 快照根目录：

- `main/main.cpp:1422-1477`：进入 `setup2()` 后初始化平台 OS、音频/ARVR 服务并注册核心单例。
- `main/main.cpp:1501-1506`、`servers/register_server_types.cpp:110-124`：注册服务器相关的 ClassDB 类型；主流程随后通过 `VisualServer` 设置默认清屏色。
- `main/main.cpp:1615-1633`：注册场景类型和模块，并初始化主题等依赖。
- `main/main.cpp:1648-1657`：创建相机服务，初始化物理/导航服务，再调用 `register_server_singletons()` 和 `ScriptServer::init_languages()`。
- `servers/register_server_types.cpp:211-220`：将 `VisualServer`、物理、音频、导航等对象分别添加为 Engine 单例。
- `servers/visual_server.cpp:2286`、`2513-2516`：绑定 `get_render_info()` 与帧统计常量；`core/bind/core_bind.cpp:2949-2950`、`3119` 提供 GDScript 可用的 `ClassDB.class_exists()`。

调用摘要：`setup2()` 初始化平台服务 → 注册服务类 → 注册场景类 → 初始化物理/导航 → 发布服务器单例 → 初始化脚本语言。ClassDB 类型存在，不等于一个服务单例已发布；源码分别处理这两件事。

## 最小实验

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
