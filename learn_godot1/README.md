# Godot 1.1 源码学习

源码依据：`engine/godot-1.1/`，版本标记见 `version.py`（Godot 1.1 stable）。

本课程按 Godot 1.1 的 C++ 源码职责组织，并用兼容本代工程格式的最小项目观察行为。类名、资源格式、编辑器和运行时入口均以 1.1 快照为准。

- [课程大纲](课程大纲.md)
- [第 0 课：源码快照与目录地图](s00_source_map/README.md)
- [第 1 课：平台入口如何进入 Main](s01_platform_entry/README.md)
- [第 2 课：`Main::setup()` 参数解析与第一阶段初始化](s02_main_setup/README.md)
- [第 3 课：`Main::setup2()` 与场景/服务器注册](s03_main_setup2/README.md)
- [第 4 课：`Main::start()` 装载主场景与创建主循环](s04_runtime_start/README.md)

每课将列出源码文件与关键调用、实验工程、可观察结果和简化边界。Godot 1.1 的运行时版本查询能力与新版本不同；版本确认以源码元数据和本代工具为准。

Godot 1.1 不通过 GDScript 暴露运行时版本字典；S00 用旧版工具的版本标识确认运行时，并用 `MainLoop` 脚本验证脚本执行链。
