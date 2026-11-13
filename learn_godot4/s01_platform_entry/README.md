# 第 1 课：平台入口如何进入 `Main`

**目标：** 以 Godot 4.7 的 macOS 桌面入口为例，追踪 AppKit 启动、`OS_MacOS` 运行和 `Main` 初始化之间的交接，并用最小项目脚本观察场景启动抵达 `_ready()`。

## 本课问题

`main()` 怎样决定 macOS OS 实例类型？普通桌面运行为什么先进入 AppKit 事件循环？哪个回调再启动 `Main` 和项目主场景？

## C++ 源码追踪

以下路径相对于 `engine/godot-4.7/` 快照根目录：

- `platform/macos/godot_main_macos.mm:41-141`：入口初始化 profiler，清理 macOS 注入的参数，识别 headless/embedded 模式，创建对应的 `OS_MacOS` 实例，最后调用 `os->run()`。普通桌面模式选择 `OS_MacOS_NSApp`。
- `platform/macos/os_macos.mm:1107-1109`：`OS_MacOS_NSApp::run()` 进入 `[NSApp run]`；AppKit 的启动回调再调用 `OS_MacOS_NSApp::start_main()`，见 `platform/macos/godot_application_delegate.mm:142-143`。
- `platform/macos/os_macos.mm:1119-1138`：`start_main()` 调用 `Main::setup()` 和 `Main::start()`，随后初始化 `main_loop`。`Main::start()` 在 `main/main.cpp:4760-4768` 加载并实例化主场景，再加入 `SceneTree`；`main_loop->initialize()` 之后，AppKit observer 才开始在 `os_macos.mm:1157` 调用 `Main::iteration()`。
- `scene/main/scene_tree.cpp:586-591`、`scene/main/node.cpp:3363-3381`：`SceneTree::initialize()` 调用 root 的 `_set_tree()`；Node 进入树后传播 READY 通知。
- `main/main.cpp:1035-1068`：`Main::setup()` 初始化 OS、创建 `Engine` 并注册核心类型。
- `main/main.cpp:4013-4017`、`4335-4346`：`Main::start()` 成功后主场景可被启动；当没有脚本或命令行场景时，从 `application/run/main_scene` 读取项目主场景。
- `scene/main/node.cpp:255-280`、`323-338`：Node 处理 READY 通知时调用 GDScript `_ready()`；节点树的 ready 传播从子节点开始，再通知父节点。

路径摘要：macOS `main()` → 选择 `OS_MacOS_NSApp` → AppKit `run` → `applicationDidFinishLaunching` → `start_main()` → `Main::setup()` / `Main::start()` → 主场景加入 `SceneTree` → `main_loop->initialize()` → Node READY → GDScript `_ready()`。之后 AppKit observer 才开始逐帧调用 `Main::iteration()`。Headless 和 embedded 会选不同 OS 子类，不走普通 NSApp 回调，但各自的 `run()` 也负责进入 `Main`。

## 最小实验

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

## 本课 C++ 源码摘录

课内摘录保留对应 Godot 源码行段正文，并在段首标出原始行号；完整上下文以只读的 engine 快照为准。摘录用于追踪，不是独立编译单元。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | Godot 源文件 | 上游行段 |
| --- | --- | --- |
| [main.cpp](src/upstream/main/main.cpp.excerpt) | godot-4.7/main/main.cpp | 1035-1068, 4013-4017, 4760-4768 |
| [godot_application_delegate.mm](src/upstream/platform/macos/godot_application_delegate.mm.excerpt) | godot-4.7/platform/macos/godot_application_delegate.mm | 142-143 |
| [godot_main_macos.mm](src/upstream/platform/macos/godot_main_macos.mm.excerpt) | godot-4.7/platform/macos/godot_main_macos.mm | 41-141 |
| [os_macos.mm](src/upstream/platform/macos/os_macos.mm.excerpt) | godot-4.7/platform/macos/os_macos.mm | 1107-1109, 1119-1138 |
| [node.cpp](src/upstream/scene/main/node.cpp.excerpt) | godot-4.7/scene/main/node.cpp | 255-280, 3363-3381 |
| [scene_tree.cpp](src/upstream/scene/main/scene_tree.cpp.excerpt) | godot-4.7/scene/main/scene_tree.cpp | 586-591 |
