# Godot 3.6 源码学习

源码依据：`engine/godot-3.6/`，版本标记为 `3.6.4-rc`。使用 project.godot、ClassDB、Reference、VisualServer 与 FuncRef 等本代接口。

本课程的已编写范围为 S00–S30。每课都是独立项目，按“问题 → C++ 调用链 → 上游源码摘录 → 最小 GDScript 实验 → 观察与边界”阅读。

S00–S10 与 S21–S30 在 `src/upstream/` 保留逐字节的完整上游 C++ 文件，并配带原始行号的函数摘录；S11–S20 仍以原文摘录为主。课程中的 `src/source_replay.gd` 是按所选调用路径写成的可运行 GDScript 教学模型，不替代引擎实现。完整源码依据仍是只读 `engine/` 快照，许可文本见 [SOURCE_LICENSE.txt](SOURCE_LICENSE.txt)。

## 课程入口

- [S00–S30 课程大纲](课程大纲.md)
- [第 0 课：源码快照与目录地图](./s00_source_map/README.md)
- [第 1 课：平台启动代码到 `Main`](./s01_platform_entry/README.md)
- [第 2 课：`Main::setup()` 参数解析、项目路径和启动模式](./s02_main_setup/README.md)
- [第 3 课：ClassDB 注册及服务器初始化](./s03_engine_server_init/README.md)
- [第 4 课：`Main::start()`、主场景装载与 `SceneTree` 创建](./s04_main_start/README.md)
- [第 5 课：`Main::iteration()` 的帧时钟、物理步与绘制](./s05_main_iteration/README.md)
- [第 6 课：`SceneTree::iteration()` 与 idle 更新](./s06_scenetree_iteration/README.md)
- [第 7 课：`ObjectDB`、实例 ID 与 `Reference` 销毁](./s07_object_lifetime/README.md)
- [第 8 课：`ClassDB` 类型注册与动态实例化](./s08_classdb_registration/README.md)
- [第 9 课：Variant 类型、构造转换与动态调用](./s09_variant_dynamic_values/README.md)
- [第 10 课：信号连接与 FuncRef 回调](./s10_signals_func_ref/README.md)
- [第 11 课：Reference 引用计数与 Resource 所有权](./s11_reference_ownership/README.md)
- [第 12 课：GDScript tokenizer、parser 与编译](./s12_gdscript_parse_compile/README.md)
- [第 13 课：GDScript 实例执行、函数状态与 yield](./s13_gdscript_execution_yield/README.md)
- [第 14 课：Node 父子关系、NodePath 与 owner](./s14_node_hierarchy_owner/README.md)
- [第 15 课：SceneTree 生命周期通知与回调顺序](./s15_node_lifecycle/README.md)
- [第 16 课：_process、_physics_process 与优先级](./s16_process_physics_process/README.md)
- [第 17 课：节点组分派与暂停模式](./s17_pause_groups/README.md)
- [第 18 课：call_deferred、删除队列与 queue_free](./s18_deferred_calls_free/README.md)
- [第 19 课：Node2D 变换与 CanvasItem 更新](./s19_node2d_canvasitem/README.md)
- [第 20 课：Spatial 局部/全局变换与通知](./s20_spatial_transform/README.md)

- [第 21 课：Resource 路径、引用计数与生命周期](./s21_resource_reference/README.md)
- [第 22 课：ResourceLoader 与格式加载器注册](./s22_resource_format_loader/README.md)
- [第 23 课：ResourceInteractiveLoader 的阶段推进](./s23_interactive_loading/README.md)
- [第 24 课：ResourceLoader 线程重入跟踪与 API 边界](./s24_resource_loader_thread_boundary/README.md)
- [第 25 课：ResourceCache 路径映射与共享资源](./s25_resource_cache/README.md)
- [第 26 课：PackedScene 的 pack、instance 与场景实例](./s26_packed_scene_instance/README.md)
- [第 27 课：场景继承、实例覆盖与外部依赖](./s27_scene_inheritance_dependencies/README.md)
- [第 28 课：平台输入到 InputEvent 的构造路径](./s28_input_event_flow/README.md)
- [第 29 课：InputMap 动作映射与输入状态](./s29_input_map/README.md)
- [第 30 课：Viewport 输入分发与未处理事件阶段](./s30_viewport_input_dispatch/README.md)

## 阅读与运行

先读课内的 C++ 调用链和摘录，再运行对应目录中的最小项目，将脚本输出与源码路径逐项对应。每课 README 给出该代命令、预期观察和简化边界；如未明确记录运行环境与日志，实验只视为待运行，不当作运行验证。

课程只描述对应快照确认的实现。跨版本差异分别记录，不把新版 API 或行为反推到旧版。Godot 快照保持只读；运行前使用与课程兼容的 Godot 程序。
