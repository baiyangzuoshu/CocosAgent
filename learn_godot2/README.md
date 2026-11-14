# Godot 2.1 源码学习

源码依据：`engine/godot-2.1/`，版本标记为 `2.1.7-rc`。使用 engine.cfg、文本 .tscn、ObjectTypeDB 与旧版 GDScript API。

本课程的已编写范围为 S00–S30。每课都是独立项目，按“问题 → C++ 调用链 → 上游源码摘录 → 最小 GDScript 实验 → 观察与边界”阅读。

S00–S10 与 S21–S30 在 `src/upstream/` 保留逐字节的完整上游 C++ 文件，并配带原始行号的函数摘录；S11–S20 仍以原文摘录为主。课程中的 `src/source_replay.gd` 是按所选调用路径写成的可运行 GDScript 教学模型，不替代引擎实现。完整源码依据仍是只读 `engine/` 快照，许可文本见 [SOURCE_LICENSE.txt](SOURCE_LICENSE.txt)。

## 课程入口

- [S00–S30 课程大纲](课程大纲.md)
- [第 0 课：源码快照与目录地图](./s00_source_map/README.md)
- [第 1 课：平台 `main()` 到 `Main`](./s01_platform_entry/README.md)
- [第 2 课：命令行、项目路径与 `Main::setup()`](./s02_main_setup/README.md)
- [第 3 课：类型注册、单例和服务器初始化](./s03_engine_server_init/README.md)
- [第 4 课：`Main::start()`、主场景装载与主循环创建](./s04_main_start_scene/README.md)
- [第 5 课：`Main::iteration()` 的固定步进与帧绘制](./s05_main_iteration/README.md)
- [第 6 课：`SceneTree::iteration()` 与 idle 更新](./s06_scenetree_iteration/README.md)
- [第 7 课：`Object` 实例 ID 与 `Reference` 引用计数](./s07_object_lifetime/README.md)
- [第 8 课：`ObjectTypeDB` 注册、继承与实例化](./s08_object_typedb/README.md)
- [第 9 课：MethodBind、属性绑定与脚本动态访问](./s09_method_property_bindings/README.md)
- [第 10 课：Variant 转换与运算分派](./s10_variant_dispatch/README.md)
- [第 11 课：Object 信号连接、绑定与跨对象调用](./s11_signals_notifications/README.md)
- [第 12 课：GDScript tokenizer、parser 与编译准备](./s12_gdscript_parser/README.md)
- [第 13 课：GDScript 实例成员访问与虚方法调用](./s13_gdscript_runtime/README.md)
- [第 14 课：Node 父子树、NodePath 与 owner](./s14_node_tree_owner/README.md)
- [第 15 课：Node 加入树、ready 与退出树通知](./s15_node_lifecycle/README.md)
- [第 16 课：SceneTree idle/fixed 与处理通知](./s16_process_notification/README.md)
- [第 17 课：节点组分派、暂停与 pause mode](./s17_groups_pause/README.md)
- [第 18 课：延迟调用队列与延迟删除](./s18_deferred_delete/README.md)
- [第 19 课：Node2D 变换、CanvasItem 与 2D 绘制](./s19_node2d_canvas/README.md)
- [第 20 课：Spatial 局部变换与父子全局变换](./s20_spatial_transform/README.md)

- [第 21 课：Resource、Reference 与路径归属](./s21_resource_reference/README.md)
- [第 22 课：ResourceLoader 格式注册与分派](./s22_resource_format_loader/README.md)
- [第 23 课：ResourceInteractiveLoader 的分阶段加载](./s23_interactive_loader/README.md)
- [第 24 课：分帧读取与阻塞 wait 的边界](./s24_incremental_loading_boundary/README.md)
- [第 25 课：ResourceCache 路径缓存与共享实例](./s25_resource_cache/README.md)
- [第 26 课：PackedScene 的 pack、instance 与子场景](./s26_packed_scene_instance/README.md)
- [第 27 课：文本场景中的外部资源依赖](./s27_scene_serialization/README.md)
- [第 28 课：平台事件到 InputEvent 的构造路径](./s28_input_event_creation/README.md)
- [第 29 课：InputMap 动作绑定与状态查询](./s29_input_map_actions/README.md)
- [第 30 课：Node 输入、未处理输入与传播顺序](./s30_node_input_flow/README.md)

## 阅读与运行

先读课内的 C++ 调用链和摘录，再运行对应目录中的最小项目，将脚本输出与源码路径逐项对应。每课 README 给出该代命令、预期观察和简化边界；如未明确记录运行环境与日志，实验只视为待运行，不当作运行验证。

课程只描述对应快照确认的实现。跨版本差异分别记录，不把新版 API 或行为反推到旧版。Godot 快照保持只读；运行前使用与课程兼容的 Godot 程序。
