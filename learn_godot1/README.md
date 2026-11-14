# Godot 1.1 源码学习

源码依据：`engine/godot-1.1/`，版本标记为 `1.1 stable`。旧版工程使用 engine.cfg / 文本 .xml 场景；S00 不依赖现代 Engine.get_version_info()。

本课程的已编写范围为 S00–S30。每课都是独立项目，按“问题 → C++ 调用链 → 上游源码摘录 → 最小 GDScript 实验 → 观察与边界”阅读。

S00–S10 与 S21–S30 在 `src/upstream/` 保留逐字节的完整上游 C++ 文件，并配带原始行号的函数摘录；S11–S20 仍以原文摘录为主。课程中的 `src/source_replay.gd` 是按所选调用路径写成的可运行 GDScript 教学模型，不替代引擎实现。完整源码依据仍是只读 `engine/` 快照，许可文本见 [SOURCE_LICENSE.txt](SOURCE_LICENSE.txt)。

## 课程入口

- [S00–S30 课程大纲](课程大纲.md)
- [第 0 课：源码快照与目录地图](./s00_source_map/README.md)
- [第 1 课：平台入口如何进入 `Main`](./s01_platform_entry/README.md)
- [第 2 课：`Main::setup()` 参数解析与第一阶段初始化](./s02_main_setup/README.md)
- [第 3 课：`Main::setup2()` 与场景/服务器注册](./s03_main_setup2/README.md)
- [第 4 课：`Main::start()` 装载主场景与创建主循环](./s04_runtime_start/README.md)
- [第 5 课：`Main::iteration()` 的固定步进与帧提交](./s05_main_iteration/README.md)
- [第 6 课：`SceneTree` 更新、输入路由与退出](./s06_scene_main_loop/README.md)
- [第 7 课：`Object` ID、显式释放与 `Reference` 生命周期](./s07_object_lifetime/README.md)
- [第 8 课：`ObjectTypeDB` 注册与原生类实例创建](./s08_object_typedb/README.md)
- [第 9 课：MethodBind、属性绑定与脚本动态访问](./s09_method_property_binding/README.md)
- [第 10 课：Variant 转换与运算分派](./s10_variant_dispatch/README.md)
- [第 11 课：Object 信号连接、绑定与跨对象发射](./s11_object_signals/README.md)
- [第 12 课：GDScript tokenizer、parser 与脚本验证](./s12_gdscript_parse/README.md)
- [第 13 课：GDScript 实例属性与方法调用](./s13_gdscript_instance/README.md)
- [第 14 课：Node 父子关系、路径查找与场景归属](./s14_node_hierarchy/README.md)
- [第 15 课：Node 进入树、ready 与退出通知顺序](./s15_node_lifecycle/README.md)
- [第 16 课：SceneTree idle/fixed 与节点处理回调](./s16_node_process/README.md)
- [第 17 课：节点组调用、暂停与 pause mode](./s17_groups_pause/README.md)
- [第 18 课：MessageQueue 延迟调用与 queue_free](./s18_deferred_free/README.md)
- [第 19 课：Node2D、CanvasItem 与 2D 变换提交](./s19_viewport_canvasitem/README.md)
- [第 20 课：Spatial 局部变换与父子全局变换](./s20_spatial_transform/README.md)

- [第 21 课：Resource 路径与 Reference 生命周期](./s21_resource_lifetime/README.md)
- [第 22 课：ResourceLoader 的格式选择](./s22_resource_loader/README.md)
- [第 23 课：ResourceInteractiveLoader 的逐阶段读取](./s23_interactive_loading/README.md)
- [第 24 课：ResourceCache 的路径与共享引用](./s24_resource_cache/README.md)
- [第 25 课：PackedScene 的 pack 与 instance](./s25_packed_scene_instance/README.md)
- [第 26 课：场景外部资源依赖与读取顺序](./s26_scene_resource_dependencies/README.md)
- [第 27 课：平台输入事件如何进入 Input](./s27_platform_input_event/README.md)
- [第 28 课：InputMap 动作与事件匹配](./s28_input_map/README.md)
- [第 29 课：Node 输入与未处理输入分发](./s29_node_input_dispatch/README.md)
- [第 30 课：Viewport 输入路由与局部坐标](./s30_viewport_input/README.md)

## 阅读与运行

先读课内的 C++ 调用链和摘录，再运行对应目录中的最小项目，将脚本输出与源码路径逐项对应。每课 README 给出该代命令、预期观察和简化边界；如未明确记录运行环境与日志，实验只视为待运行，不当作运行验证。

课程只描述对应快照确认的实现。跨版本差异分别记录，不把新版 API 或行为反推到旧版。Godot 快照保持只读；运行前使用与课程兼容的 Godot 程序。
