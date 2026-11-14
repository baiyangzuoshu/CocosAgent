# 第 1 课：平台启动代码到 `Main`

**目标：** 以 Godot 3.6 的 macOS 桌面入口为例，沿 C++ 追踪参数如何交给 `Main`，再用最小场景脚本观察启动抵达 `_ready()`。

## 本课增量

把平台入口的控制权交接写成可执行状态流程，分别观察 setup 成功进入 Main::start 和失败提前返回。

**本课要回答：** 平台层如何处理 macOS 打开的场景文件？`Main::setup()` 的错误码如何影响后续启动？`application/run/main_scene` 最终怎样触发脚本 READY？

## C++ 源码追踪

源码依据：`engine/godot-3.6/`（Godot 3.6 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-3.6/` 快照根目录：

- `platform/osx/godot_main_osx.mm:38-78`：macOS `main()` 过滤系统参数；如果系统以文件关联打开场景，则优先传入 `open_with_filename`，否则传入清理后的 argv。`ERR_HELP` 作为成功退出处理，正常路径调用 `Main::start()`、`os.run()`，随后 `Main::cleanup()`。
- `main/main.cpp:418-437`：`Main::setup()` 初始化 OS 核心、创建 `Engine` 并注册核心类型；命令行和项目初始化继续在该方法中完成。
- `main/main.cpp:1682`、`1859-1860`：`Main::start()` 在没有脚本或显式场景参数时读取 `application/run/main_scene`。实验项目把该键设为 `res://main.tscn`。
- `platform/osx/os_osx.mm:3442-3474`、`scene/main/scene_tree.cpp:521-526`：`OS_OSX::run()` 调用主循环 `init()`；`SceneTree::init()` 把 root 接入 SceneTree，然后平台循环开始调用 `Main::iteration()`。
- `scene/main/node.cpp:2868-2885`、`188-200`、`145-167`：`Node::_set_tree()` 传播 enter-tree 与 READY；Node 在 `NOTIFICATION_READY` 中调用挂载脚本的 `_ready()`。

路径摘要：macOS `main()` → `Main::setup(argv)` → `Main::start()` 选择主场景/主循环 → `OS_OSX::run()` → `SceneTree::init()` → Node READY → GDScript `_ready()`。平台打开单个场景文件的特例和普通项目启动共享 `Main`，但参数来源不同。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [418-437 ; 1682-1682](src/upstream/main/main.cpp.excerpt) | engine/godot-3.6/main/main.cpp |
| 2 | [godot_main_osx.mm](src/upstream/platform/osx/godot_main_osx.mm) | [38-78](src/upstream/platform/osx/godot_main_osx.mm.excerpt) | engine/godot-3.6/platform/osx/godot_main_osx.mm |
| 3 | [os_osx.mm](src/upstream/platform/osx/os_osx.mm) | [3442-3474](src/upstream/platform/osx/os_osx.mm.excerpt) | engine/godot-3.6/platform/osx/os_osx.mm |
| 4 | [node.cpp](src/upstream/scene/main/node.cpp) | [2868-2885](src/upstream/scene/main/node.cpp.excerpt) | engine/godot-3.6/scene/main/node.cpp |
| 5 | [scene_tree.cpp](src/upstream/scene/main/scene_tree.cpp) | [521-526](src/upstream/scene/main/scene_tree.cpp.excerpt) | engine/godot-3.6/scene/main/scene_tree.cpp |

## GDScript 源码复刻

`src/source_replay.gd` 按本课列出的 C++ 入口重建关键数据结构、条件分支和状态更新。它是可逐步阅读的教学移植，不是完整引擎替身；模型函数表会标明直接对应的源码行为和仅用于组织输入/输出的脚手架。平台、线程、对象分配和服务器副作用仍由真实引擎处理。

| 模型函数 | C++ 源码对照或脚手架性质 | 复现的状态与分支 |
| --- | --- | --- |
| `_new_run()` | `教学脚手架：新建一份独立运行状态，不对应 C++ 函数` | 创建一次独立运行的输入、标志位和观察记录。 |
| `_platform_main()` | `platform/osx/godot_main_osx.mm::main / OS_OSX::run` | 按平台入口顺序调用 setup、start、run 并处理返回码。 |
| `_main_setup()` | `Main::setup` | 在参数有效后保存 OS 命令行并推进初始化阶段。 |
| `_main_start()` | `Main::start` | 仅在 setup 成功后建立主循环/主场景状态。 |
| `_print_trace()` | `教学脚手架：输出模型状态，不对应 C++ 函数` | 逐项输出模型状态，方便与源码阶段对照。 |

## 最小 Godot/GDScript 实验

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

## 下一课

继续阅读 [s02_main_setup](../s02_main_setup/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
