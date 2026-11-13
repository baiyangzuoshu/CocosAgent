# Godot 3.6 源码学习

源码依据：`engine/godot-3.6/`，版本标记见 `version.py`（Godot 3.6.4-rc）。

本课程追踪 Godot 3.6 的 C++ 源码，并用该代 Godot/GDScript 项目观察公开行为。课程保留 `VisualServer`、`PackedScene::instance()` 和 GDNative 等本代边界，不套用 Godot 4 的命名。

- [课程大纲](课程大纲.md)
- [第 0 课：源码快照与目录地图](s00_source_map/README.md)
- [第 1 课：平台启动代码到 `Main`](s01_platform_entry/README.md)
- [第 2 课：`Main::setup()` 参数解析、项目路径和启动模式](s02_main_setup/README.md)
- [第 3 课：ClassDB 注册及服务器初始化](s03_engine_server_init/README.md)
- [第 4 课：`Main::start()`、主场景装载与 `SceneTree` 创建](s04_main_start/README.md)

每课列出源码文件与关键调用、独立实验、可观察结果和简化范围；编辑器、导出和目标平台结果分别记录。

Godot 3.6 的版本查询通过 `Engine.get_version_info()` 暴露；实验项目使用本代 `project.godot` 与 GDScript 语法。
