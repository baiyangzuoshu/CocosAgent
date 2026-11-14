# 第 1 课：平台入口如何进入 `Main`

**目标：** 以 Godot 4.7 的 macOS 桌面入口为例，追踪 AppKit 启动、`OS_MacOS` 运行和 `Main` 初始化之间的交接，并用最小项目脚本观察场景启动抵达 `_ready()`。

## 本课增量

把平台入口的控制权交接写成可执行状态流程，分别观察 setup 成功进入 Main::start 和失败提前返回。

## 本课问题

`main()` 怎样决定 macOS OS 实例类型？普通桌面运行为什么先进入 AppKit 事件循环？哪个回调再启动 `Main` 和项目主场景？

## 源码调用链

源码依据：`engine/godot-4.7/`（Godot 4.7 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-4.7/` 快照根目录：

- `platform/macos/godot_main_macos.mm:41-141`：入口初始化 profiler，清理 macOS 注入的参数，识别 headless/embedded 模式，创建对应的 `OS_MacOS` 实例，最后调用 `os->run()`。普通桌面模式选择 `OS_MacOS_NSApp`。
- `platform/macos/os_macos.mm:1107-1109`：`OS_MacOS_NSApp::run()` 进入 `[NSApp run]`；AppKit 的启动回调再调用 `OS_MacOS_NSApp::start_main()`，见 `platform/macos/godot_application_delegate.mm:142-143`。
- `platform/macos/os_macos.mm:1119-1138`：`start_main()` 调用 `Main::setup()` 和 `Main::start()`，随后初始化 `main_loop`。`Main::start()` 在 `main/main.cpp:4760-4768` 加载并实例化主场景，再加入 `SceneTree`；`main_loop->initialize()` 之后，AppKit observer 才开始在 `os_macos.mm:1157` 调用 `Main::iteration()`。
- `scene/main/scene_tree.cpp:586-591`、`scene/main/node.cpp:3363-3381`：`SceneTree::initialize()` 调用 root 的 `_set_tree()`；Node 进入树后传播 READY 通知。
- `main/main.cpp:1035-1068`：`Main::setup()` 初始化 OS、创建 `Engine` 并注册核心类型。
- `main/main.cpp:4013-4017`、`4335-4346`：`Main::start()` 成功后主场景可被启动；当没有脚本或命令行场景时，从 `application/run/main_scene` 读取项目主场景。
- `scene/main/node.cpp:255-280`、`323-338`：Node 处理 READY 通知时调用 GDScript `_ready()`；节点树的 ready 传播从子节点开始，再通知父节点。

路径摘要：macOS `main()` → 选择 `OS_MacOS_NSApp` → AppKit `run` → `applicationDidFinishLaunching` → `start_main()` → `Main::setup()` / `Main::start()` → 主场景加入 `SceneTree` → `main_loop->initialize()` → Node READY → GDScript `_ready()`。之后 AppKit observer 才开始逐帧调用 `Main::iteration()`。Headless 和 embedded 会选不同 OS 子类，不走普通 NSApp 回调，但各自的 `run()` 也负责进入 `Main`。

## 本课源码复刻

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-4.7` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [摘录](src/upstream/main/main.cpp.excerpt) | `engine/godot-4.7/main/main.cpp` | 1035-1068 |
| 2 | [godot_application_delegate.mm](src/upstream/platform/macos/godot_application_delegate.mm) | [摘录](src/upstream/platform/macos/godot_application_delegate.mm.excerpt) | `engine/godot-4.7/platform/macos/godot_application_delegate.mm` | 142-143 |
| 3 | [godot_main_macos.mm](src/upstream/platform/macos/godot_main_macos.mm) | [摘录](src/upstream/platform/macos/godot_main_macos.mm.excerpt) | `engine/godot-4.7/platform/macos/godot_main_macos.mm` | 41-141 |
| 4 | [os_macos.mm](src/upstream/platform/macos/os_macos.mm) | [摘录](src/upstream/platform/macos/os_macos.mm.excerpt) | `engine/godot-4.7/platform/macos/os_macos.mm` | 1107-1109, 1119-1138 |
| 5 | [node.cpp](src/upstream/scene/main/node.cpp) | [摘录](src/upstream/scene/main/node.cpp.excerpt) | `engine/godot-4.7/scene/main/node.cpp` | 255-280, 3363-3381 |
| 6 | [scene_tree.cpp](src/upstream/scene/main/scene_tree.cpp) | [摘录](src/upstream/scene/main/scene_tree.cpp.excerpt) | `engine/godot-4.7/scene/main/scene_tree.cpp` | 586-591 |

## GDScript 源码复刻与 C++ 对照

模型实际执行成功和 setup 失败两条路径；失败会在 Main::start 之前返回，成功路径进入 MainLoop 并执行 cleanup。

src/upstream/ 保存本课引用的完整上游文件副本和带原始行号的摘录；src/source_replay.gd 执行表中的教学模型。先观察模型如何改变状态或走分支，再回到对应 C++ 函数核对。模型不替代 C++，也不代表引擎运行时本身。

| C++ 追踪阶段 | 模型函数 | 运行时要观察什么 |
| --- | --- | --- |
| macOS platform entry | _platform_entry() | 执行入口交接、成功路径和 setup 错误返回 |
| Main::setup() / Main::start() | _main_setup() → _main_start() | 检查 start 只在 setup 成功后执行 |
| OS::run() / SceneTree::init() / READY | _os_run() → _main_loop_initialize() | 模拟 MainLoop 初始化和节点 READY |

独立项目入口先调用 source_replay.gd，再执行真实 Godot API 实验。实验脚本：entry_probe.gd。模型输出是确定性的教学数据；只有实际用对应版本 Godot 运行后，才能记录为引擎实验验证。
## 最小 Godot/GDScript 实验

- `project.godot`：Godot 4.7 项目配置，设置 `run/main_scene`。
- `main.tscn`：format 3 文本场景，只有一个挂载脚本的 Node。
- `entry_probe.gd`：在 `_ready()` 打印启动标记。

使用 Godot 4.7 编辑器打开本目录并按 F5 运行，或在本目录执行：

```sh
godot --path .
```

预期看到 `S01 reached: the main scene root entered READY.`。该输出只表明当前运行工具启动了项目脚本；只有使用与课程快照对应的工具版本，才可将其作为相应版本的运行证据。

## 简化与边界

本课聚焦 macOS 普通桌面 AppKit 路径。`godot_main_macos.mm` 的 mode 分流、`OS_MacOS_Headless::run()` 和 `OS_MacOS_Embedded::run()` 是不同入口分支，实验不覆盖它们；其他操作系统也有各自的平台启动文件。此实验尚未运行。

## 下一课

继续阅读 [s02_main_setup](../s02_main_setup/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
