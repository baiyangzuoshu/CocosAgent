# Godot 1.1 源码学习

源码依据：`engine/godot-1.1/`，版本标记为 `1.1 stable`。旧版工程使用 engine.cfg / 文本 .xml 场景；S00 不依赖现代 Engine.get_version_info()。

本课程的已编写范围为 S00–S10。每课都是独立项目，按“问题 → C++ 调用链 → 上游源码摘录 → 最小 GDScript 实验 → 观察与边界”阅读。

课内 `src/upstream/` 保留本地快照中与本课直接相关的 C++ 源码行段，并在摘录中标出原始路径和行号；它用于逐行对照，不是单独编译的引擎副本。完整上下文以只读 `engine/` 快照为准，许可文本见 [SOURCE_LICENSE.txt](SOURCE_LICENSE.txt)。

## 课程入口

- [S00–S10 课程大纲](课程大纲.md)
- [第 0 课：第 0 课：源码快照与目录地图](./s00_source_map/README.md)
- [第 1 课：第 1 课：平台入口如何进入 `Main`](./s01_platform_entry/README.md)
- [第 2 课：第 2 课：`Main::setup()` 参数解析与第一阶段初始化](./s02_main_setup/README.md)
- [第 3 课：第 3 课：`Main::setup2()` 与场景/服务器注册](./s03_main_setup2/README.md)
- [第 4 课：第 4 课：`Main::start()` 装载主场景与创建主循环](./s04_runtime_start/README.md)
- [第 5 课：第 5 课：`Main::iteration()` 的固定步进与帧提交](./s05_main_iteration/README.md)
- [第 6 课：第 6 课：`SceneTree` 更新、输入路由与退出](./s06_scene_main_loop/README.md)
- [第 7 课：第 7 课：`Object` ID、显式释放与 `Reference` 生命周期](./s07_object_lifetime/README.md)
- [第 8 课：第 8 课：`ObjectTypeDB` 注册与原生类实例创建](./s08_object_typedb/README.md)
- [第 9 课：第 9 课：MethodBind、属性绑定与脚本动态访问](./s09_method_property_binding/README.md)
- [第 10 课：第 10 课：Variant 转换与运算分派](./s10_variant_dispatch/README.md)

## 阅读与运行

先读课内的 C++ 调用链和摘录，再运行对应目录中的最小项目，将脚本输出与源码路径逐项对应。每课 README 给出该代命令、预期观察和简化边界；如未明确记录运行环境与日志，实验只视为待运行，不当作运行验证。

课程只描述对应快照确认的实现。跨版本差异分别记录，不把新版 API 或行为反推到旧版。Godot 快照保持只读；运行前使用与课程兼容的 Godot 程序。
