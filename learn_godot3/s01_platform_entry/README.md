# 第 1 课：平台启动代码到 `Main`

**目标：** 以 Godot 3.6 的 macOS 桌面入口为例，沿 C++ 追踪参数如何交给 `Main`，再用最小场景脚本观察启动抵达 `_ready()`。

## 本课问题

平台层如何处理 macOS 打开的场景文件？`Main::setup()` 的错误码如何影响后续启动？`application/run/main_scene` 最终怎样触发脚本 READY？

## C++ 源码追踪

以下路径相对于 `engine/godot-3.6/` 快照根目录：

- `platform/osx/godot_main_osx.mm:38-78`：macOS `main()` 过滤系统参数；如果系统以文件关联打开场景，则优先传入 `open_with_filename`，否则传入清理后的 argv。`ERR_HELP` 作为成功退出处理，正常路径调用 `Main::start()`、`os.run()`，随后 `Main::cleanup()`。
- `main/main.cpp:418-437`：`Main::setup()` 初始化 OS 核心、创建 `Engine` 并注册核心类型；命令行和项目初始化继续在该方法中完成。
- `main/main.cpp:1682`、`1859-1860`：`Main::start()` 在没有脚本或显式场景参数时读取 `application/run/main_scene`。实验项目把该键设为 `res://main.tscn`。
- `platform/osx/os_osx.mm:3442-3474`、`scene/main/scene_tree.cpp:521-526`：`OS_OSX::run()` 调用主循环 `init()`；`SceneTree::init()` 把 root 接入 SceneTree，然后平台循环开始调用 `Main::iteration()`。
- `scene/main/node.cpp:2868-2885`、`188-200`、`145-167`：`Node::_set_tree()` 传播 enter-tree 与 READY；Node 在 `NOTIFICATION_READY` 中调用挂载脚本的 `_ready()`。

路径摘要：macOS `main()` → `Main::setup(argv)` → `Main::start()` 选择主场景/主循环 → `OS_OSX::run()` → `SceneTree::init()` → Node READY → GDScript `_ready()`。平台打开单个场景文件的特例和普通项目启动共享 `Main`，但参数来源不同。

## 最小实验

- `project.godot`：Godot 3.6 项目配置，设置 `run/main_scene`。
- `main.tscn`：format 2 文本场景，只有一个挂载脚本的 Node。
- `entry_probe.gd`：在 `_ready()` 输出启动标记。

使用 Godot 3.6 编辑器打开本目录并按 F5，或在本目录执行：

```sh
godot --path .
```

预期看到 `S01 reached: the main scene root entered READY.`。记录实际运行工具版本；若不是 3.6.4-rc，这次输出只证明该工具运行了此项目，不构成 3.6.4-rc 的运行验证。

## 简化与边界

本课只追踪 macOS 桌面入口，不推断 Android、iOS、Web 等平台都经过相同的原生 `main()` 文件。只观察一条启动路径，不展开 `Main::setup()`、服务器初始化或帧循环；这些内容由 S02 及后续课程分别追踪。此实验尚未运行。
