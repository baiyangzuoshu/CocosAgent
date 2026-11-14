# Godot 4.7 源码学习

源码依据：`engine/godot-4.7/`，版本标记为 `4.7.3-rc`。使用 project.godot、ClassDB、RefCounted、RenderingServer、Callable 与 Signal。

本课程的已编写范围为 S00–S30。每课都是独立项目，按“问题 → C++ 调用链 → 上游源码摘录 → 最小 GDScript 实验 → 观察与边界”阅读。

S00–S10 与 S21–S30 在 `src/upstream/` 保留完整上游 C++ 文件和原始行号摘录；S00–S10 的完整副本另由各课 `src/SOURCE_SHA256.txt` 校验。S11–S20 仍以原文摘录为主。S00–S10 与 S21–S30 的 `src/source_replay.gd` 按本代 C++ 路径复刻状态变化并保留版本边界。完整源码依据仍是只读 `engine/` 快照，许可文本见 [SOURCE_LICENSE.txt](SOURCE_LICENSE.txt)。

## 课程入口

- [S00–S30 课程大纲](课程大纲.md)
- [第 0 课：源码快照与目录地图](./s00_source_map/README.md)
- [第 1 课：平台入口如何进入 `Main`](./s01_platform_entry/README.md)
- [第 2 课：`Main::setup()` 初始化与参数流](./s02_main_setup/README.md)
- [第 3 课：引擎类型注册与服务器初始化](./s03_engine_initialization/README.md)
- [第 4 课：`MainLoop` 与 `SceneTree` 的创建和启动](./s04_main_loop_creation/README.md)
- [第 5 课：`Main::iteration()` 的物理 tick、process 与绘制](./s05_main_iteration/README.md)
- [第 6 课：`SceneTree::physics_process()` 与 `process()`](./s06_scene_tree_iteration/README.md)
- [第 7 课：`ObjectID` 与 `RefCounted` 生命周期](./s07_object_lifetime/README.md)
- [第 8 课：`ClassDB` 类型注册与动态实例化](./s08_classdb_registration/README.md)
- [第 9 课：Variant 内置类型与动态值](./s09_variant_values/README.md)
- [第 10 课：Callable 与 Signal 调用链](./s10_callable_signals/README.md)
- [第 11 课：RefCounted 引用计数与 Resource 生命周期](./s11_refcounted_resource_lifetime/README.md)
- [第 12 课：GDScript tokenizer、parser、analyzer 与编译](./s12_gdscript_compilation/README.md)
- [第 13 课：GDScript 实例化与引擎对象调用](./s13_gdscript_execution/README.md)
- [第 14 课：Node 父子关系、路径与 owner](./s14_node_hierarchy/README.md)
- [第 15 课：Node 进入场景树、ready 与退出](./s15_node_lifecycle/README.md)
- [第 16 课：SceneTree process 调度与优先级](./s16_process_scheduling/README.md)
- [第 17 课：ProcessMode、节点组与暂停传播](./s17_pause_modes/README.md)
- [第 18 课：CallQueue、call_deferred 与 queue_free](./s18_deferred_calls_free/README.md)
- [第 19 课：Node2D 变换与 CanvasItem 更新](./s19_node2d_transform/README.md)
- [第 20 课：Node3D 局部/全局变换与父级传播](./s20_node3d_transform/README.md)

- [第 21 课：Resource 路径、RefCounted 与资源身份](./s21_resource_identity/README.md)
- [第 22 课：ResourceLoader 格式分派](./s22_resource_loader/README.md)
- [第 23 课：ResourceCache、ResourceUID 与路径映射](./s23_resource_cache_uid/README.md)
- [第 24 课：线程化请求、状态轮询与结果交付](./s24_threaded_loading/README.md)
- [第 25 课：PackedScene 的 pack 与 instantiate](./s25_packed_scene_instantiation/README.md)
- [第 26 课：场景文本解析、继承与实例覆盖](./s26_scene_inheritance/README.md)
- [第 27 课：ResourceSaver 选择保存器并持久化](./s27_resource_saving/README.md)
- [第 28 课：平台事件到 InputEvent 的构造路径](./s28_input_event_flow/README.md)
- [第 29 课：InputMap 动作映射与输入状态](./s29_input_map/README.md)
- [第 30 课：Viewport 输入阶段与事件传播](./s30_viewport_input/README.md)

## 阅读与运行

先读课内的 C++ 调用链和摘录，再运行对应目录中的最小项目，将脚本输出与源码路径逐项对应。每课 README 给出该代命令、预期观察和简化边界；如未明确记录运行环境与日志，实验只视为待运行，不当作运行验证。

课程只描述对应快照确认的实现。跨版本差异分别记录，不把新版 API 或行为反推到旧版。Godot 快照保持只读；运行前使用与课程兼容的 Godot 程序。
