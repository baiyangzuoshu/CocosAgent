# 第 1 课：平台入口如何进入 `Main`

**目标：** 以 Godot 1.1 的 macOS 桌面入口为例，追踪原生 `main()` 如何把控制权交给 `Main`，并用最小场景脚本观察启动最终到达节点的 `_ready()`。

## 本课问题

平台入口在哪一刻创建 Godot 的 `OS` 实例？`Main::setup()` 失败时会怎样结束启动？应用主场景如何变成可执行的 GDScript 回调？

## C++ 源码追踪

以下路径相对于 `engine/godot-1.1/` 快照根目录：

- `platform/osx/godot_main_osx.mm:37-85`：macOS `main()` 处理从 Finder 启动时的 app bundle 工作目录，构造 `OS_OSX`，调用 `Main::setup()`；失败时返回，成功时调用 `Main::start()`，再由 `os.run()` 驱动平台循环，最后调用 `Main::cleanup()`。
- `main/main.cpp:176-185`：`Main::setup()` 从 RID 与 OS 核心初始化开始，随后注册核心类型。参数解析和项目准备继续在该函数中进行。
- `main/main.cpp:880`、`993-994`：`Main::start()` 在没有命令行指定场景时读取 `application/main_scene`。本实验的 `engine.cfg` 把它指向 `main.xml`。
- `platform/osx/os_osx.mm:1513-1540`、`scene/main/scene_main_loop.cpp:465-478`：`OS_OSX::run()` 初始化主循环；`SceneTree::init()` 把 root 接入 SceneTree，之后进入迭代循环。
- `scene/main/node.cpp:1675-1695`、`140-148`、`100-105`：`Node::_set_tree()` 传播 enter-tree 与 READY；`NOTIFICATION_READY` 最终调用挂载脚本的 `_ready()`。

路径摘要：macOS `main()` → `Main::setup()` → `Main::start()` 选择主场景/主循环 → `OS_OSX::run()` → `SceneTree::init()` → Node READY → GDScript `_ready()`。`Main::setup()` 的初始化细节留给 S02；本课只定位平台交接点。

## 最小实验

- `engine.cfg`：指定 Godot 1.1 的主场景设置 `main_scene`。
- `main.xml`：Godot 1.1 `PackedScene` 的 XML 资源，只有一个挂载脚本的 Node。
- `entry_probe.gd`：在 `_ready()` 输出一行启动标记。

使用 Godot 1.1 编辑器打开本目录并运行项目，或在本目录执行：

```sh
godot -path .
```

预期看到 `S01 reached: the main scene root entered READY.`。这说明项目主场景已进入节点 READY 阶段；它观察的是用户层启动结果，不单独证明本地二进制与课程源码来自同一构建。

## 简化与边界

本课只追踪 macOS 桌面入口。Android、Web、Windows 等平台拥有不同的启动适配层，不能把这里的 `main()` 实现套到所有平台。`main.xml` 按 Godot 1.1 的 XML `PackedScene` 格式手工缩减；本课未使用旧版引擎运行验证，实际运行前请使用 Godot 1.1 工具。

## 本课 C++ 源码摘录

课内摘录保留对应 Godot 源码行段正文，并在段首标出原始行号；完整上下文以只读的 engine 快照为准。摘录用于追踪，不是独立编译单元。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | Godot 源文件 | 上游行段 |
| --- | --- | --- |
| [main.cpp](src/upstream/main/main.cpp.excerpt) | godot-1.1/main/main.cpp | 176-185, 880-880 |
| [godot_main_osx.mm](src/upstream/platform/osx/godot_main_osx.mm.excerpt) | godot-1.1/platform/osx/godot_main_osx.mm | 37-85 |
| [os_osx.mm](src/upstream/platform/osx/os_osx.mm.excerpt) | godot-1.1/platform/osx/os_osx.mm | 1513-1540 |
| [node.cpp](src/upstream/scene/main/node.cpp.excerpt) | godot-1.1/scene/main/node.cpp | 1675-1695 |
| [scene_main_loop.cpp](src/upstream/scene/main/scene_main_loop.cpp.excerpt) | godot-1.1/scene/main/scene_main_loop.cpp | 465-478 |
