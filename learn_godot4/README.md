# Godot 4.7 源码学习

本课程以 `engine/godot-4.7/` 为源码依据；快照 `version.py` 标记为 Godot 4.7.3-rc。

课程采用 **C++ 源码追踪 + 最小 Godot/GDScript 实验**。每课项目独立运行，实验观察本代 Godot 行为，不模拟引擎内部实现。

## 课程

- [课程大纲](课程大纲.md)
- [第 0 课：源码快照与目录地图](s00_source_map/README.md)
- [第 1 课：平台入口如何进入 `Main`](s01_platform_entry/README.md)
- [第 2 课：`Main::setup()` 初始化与参数流](s02_main_setup/README.md)
- [第 3 课：引擎类型注册与服务器初始化](s03_engine_initialization/README.md)
- [第 4 课：`MainLoop` 与 `SceneTree` 的创建和启动](s04_main_loop_creation/README.md)
- [第 5 课：`Main::iteration()` 的物理 tick、process 与绘制](s05_main_iteration/README.md)
- [第 6 课：`SceneTree::physics_process()` 与 `process()`](s06_scene_tree_iteration/README.md)
- [第 7 课：`ObjectID` 与 `RefCounted` 生命周期](s07_object_lifetime/README.md)
- [第 8 课：`ClassDB` 类型注册与动态实例化](s08_classdb_registration/README.md)

每课列出源码文件、关键调用、实验入口、观察结果、简化点和验证环境。静态源码、编辑器运行、构建和目标平台证据分别记录。

运行实验前核对本机 Godot 工具版本。课程不默认构建引擎或下载依赖。
