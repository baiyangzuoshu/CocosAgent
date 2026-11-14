# 第 1 课：平台入口如何进入 `Main`

**目标：** 以 Godot 1.1 的 macOS 桌面入口为例，追踪原生 `main()` 如何把控制权交给 `Main`，并用最小场景脚本观察启动最终到达节点的 `_ready()`。

## 本课增量

把平台入口的控制权交接写成可执行状态流程，分别观察 setup 成功进入 Main::start 和失败提前返回。

**本课要回答：** 平台入口在哪一刻创建 Godot 的 `OS` 实例？`Main::setup()` 失败时会怎样结束启动？应用主场景如何变成可执行的 GDScript 回调？

## C++ 源码追踪

源码依据：`engine/godot-1.1/`（Godot 1.1 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-1.1/` 快照根目录：

- `platform/osx/godot_main_osx.mm:37-85`：macOS `main()` 处理从 Finder 启动时的 app bundle 工作目录，构造 `OS_OSX`，调用 `Main::setup()`；失败时返回，成功时调用 `Main::start()`，再由 `os.run()` 驱动平台循环，最后调用 `Main::cleanup()`。
- `main/main.cpp:176-185`：`Main::setup()` 从 RID 与 OS 核心初始化开始，随后注册核心类型。参数解析和项目准备继续在该函数中进行。
- `main/main.cpp:880`、`993-994`：`Main::start()` 在没有命令行指定场景时读取 `application/main_scene`。本实验的 `engine.cfg` 把它指向 `main.xml`。
- `platform/osx/os_osx.mm:1513-1540`、`scene/main/scene_main_loop.cpp:465-478`：`OS_OSX::run()` 初始化主循环；`SceneTree::init()` 把 root 接入 SceneTree，之后进入迭代循环。
- `scene/main/node.cpp:1675-1695`、`140-148`、`100-105`：`Node::_set_tree()` 传播 enter-tree 与 READY；`NOTIFICATION_READY` 最终调用挂载脚本的 `_ready()`。

路径摘要：macOS `main()` → `Main::setup()` → `Main::start()` 选择主场景/主循环 → `OS_OSX::run()` → `SceneTree::init()` → Node READY → GDScript `_ready()`。`Main::setup()` 的初始化细节留给 S02；本课只定位平台交接点。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [176-185 ; 880-880](src/upstream/main/main.cpp.excerpt) | engine/godot-1.1/main/main.cpp |
| 2 | [godot_main_osx.mm](src/upstream/platform/osx/godot_main_osx.mm) | [37-85](src/upstream/platform/osx/godot_main_osx.mm.excerpt) | engine/godot-1.1/platform/osx/godot_main_osx.mm |
| 3 | [os_osx.mm](src/upstream/platform/osx/os_osx.mm) | [1513-1540](src/upstream/platform/osx/os_osx.mm.excerpt) | engine/godot-1.1/platform/osx/os_osx.mm |
| 4 | [node.cpp](src/upstream/scene/main/node.cpp) | [1675-1695](src/upstream/scene/main/node.cpp.excerpt) | engine/godot-1.1/scene/main/node.cpp |
| 5 | [scene_main_loop.cpp](src/upstream/scene/main/scene_main_loop.cpp) | [465-478](src/upstream/scene/main/scene_main_loop.cpp.excerpt) | engine/godot-1.1/scene/main/scene_main_loop.cpp |

## GDScript 源码复刻

S01 Godot 1.1: macOS entry → Main::setup/start → OS::run.

source_replay.gd 按本课指定快照复刻控制流与状态传递，模型中的状态字段、函数入口和 API 名称对应本代 C++ 路径。根目录实验脚本先运行模型，再调用对应版本的 Godot API。

| GDScript 函数 | 复刻步骤 |
| --- | --- |
| _new_run() | 初始化平台入口的阶段状态 |
| _platform_main() | 按平台入口顺序执行 setup/start/run 并走错误门 |
| _main_setup() | 执行核心/项目初始化并让错误状态提前返回 |
| _main_start() | 只在 setup 成功后安装主场景和 MainLoop |
| _print_trace() | 输出成功或错误路径中的阶段记录 |

## 最小 Godot/GDScript 实验

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

## 下一课

继续阅读 [s02_main_setup](../s02_main_setup/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
