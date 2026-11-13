# Godot 2.1 源码学习

源码依据：`engine/godot-2.1/`，版本标记见 `version.py`（Godot 2.1.7-rc）。

本课程追踪 Godot 2.1 的 C++ 调用链，并用兼容本代工程格式的最小项目观察运行行为。课内保留本代 `SceneTree::iteration()`、`PackedScene::instance()` 和 VisualServer 等真实边界。

- [课程大纲](课程大纲.md)
- [第 0 课：源码快照与目录地图](s00_source_map/README.md)
- [第 1 课：平台 `main()` 到 `Main`](s01_platform_entry/README.md)

每课将列出源码文件与关键调用、实验工程、可观察结果和简化边界。运行验证只针对明确记录的 Godot 2.1 工具和平台。

Godot 2.1 的版本查询位于 `OS.get_engine_version()`；实验项目保留本代 `engine.cfg` 和文本场景格式。
