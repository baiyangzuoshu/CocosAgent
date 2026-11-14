# 第 8 课：`ObjectTypeDB` 注册与原生类实例创建

**目标：** 追踪 Godot 1.1 如何登记原生类的父类关系和创建函数，并沿 GDScript 的 `Node2D.new()` 进入 `ObjectTypeDB` 创建对象。

## 本课问题

`register_scene_types()` 如何让 `Node2D` 成为已注册类型？`register_type<T>()` 保存了哪些实例创建信息？GDScript 的原生类 `.new()` 最终调用了什么？

## 源码调用链

源码依据：`engine/godot-1.1/`（Godot 1.1 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-1.1/` 快照根目录：

- `scene/register_scene_types.cpp:231-266`、`463-466`：场景类型注册阶段登记 `Node`、虚类型 `CanvasItem` 和可实例化的 `Node2D`。
- `scene/2d/node_2d.h:34-36`：`Node2D` 的 C++ 继承关系为 `CanvasItem`。
- `core/object_type_db.cpp:300-317`：类型元数据保存类型名和已登记的父类。
- `core/object_type_db.h:195-204`：`register_type<T>()` 初始化类型，并将 `creator<T>` 保存为实例工厂；虚类型只初始化类型信息，不提供创建函数。
- `core/object_type_db.cpp:272-296`：`instance()` 检查类型状态与创建函数后调用工厂；`can_instance()` 根据同一注册信息判断是否可创建。
- `modules/gdscript/gd_script.cpp:1422-1448`：GDScript 原生类的 `.new()` 调用 `GDNativeClass::instance()`，后者转入 `ObjectTypeDB::instance()`。
- `core/object.cpp:1435-1438`：脚本可通过 `get_type()` 和 `is_type()` 观察实例类型与祖先关系。

调用摘要：场景启动注册原生类型 → 注册模板记录构造工厂 → GDScript `Node2D.new()` 找到对应原生类型对象 → 工厂创建 C++ `Node2D` 实例。

## 本课源码复刻

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-1.1` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [object.cpp](src/upstream/core/object.cpp) | [摘录](src/upstream/core/object.cpp.excerpt) | `engine/godot-1.1/core/object.cpp` | 1435-1438 |
| 2 | [object_type_db.cpp](src/upstream/core/object_type_db.cpp) | [摘录](src/upstream/core/object_type_db.cpp.excerpt) | `engine/godot-1.1/core/object_type_db.cpp` | 272-296, 300-317 |
| 3 | [object_type_db.h](src/upstream/core/object_type_db.h) | [摘录](src/upstream/core/object_type_db.h.excerpt) | `engine/godot-1.1/core/object_type_db.h` | 195-204 |
| 4 | [gd_script.cpp](src/upstream/modules/gdscript/gd_script.cpp) | [摘录](src/upstream/modules/gdscript/gd_script.cpp.excerpt) | `engine/godot-1.1/modules/gdscript/gd_script.cpp` | 1422-1448 |
| 5 | [node_2d.h](src/upstream/scene/2d/node_2d.h) | [摘录](src/upstream/scene/2d/node_2d.h.excerpt) | `engine/godot-1.1/scene/2d/node_2d.h` | 34-36 |
| 6 | [register_scene_types.cpp](src/upstream/scene/register_scene_types.cpp) | [摘录](src/upstream/scene/register_scene_types.cpp.excerpt) | `engine/godot-1.1/scene/register_scene_types.cpp` | 231-266 |

## 可运行源码复刻

课程代码 [`src/source_replay.gd`](src/source_replay.gd) 按本课 C++ 函数关系实现一个小型 GDScript 模型；入口脚本会先运行它，再执行下面的真实引擎 API 实验。阅读时把模型中的状态变化逐步映射到上方的 C++ 摘录。模型只复刻本课选出的路径，不声称等同于完整 Godot 引擎。

## 最小 Godot/GDScript 实验

- `engine.cfg` 指向 Godot 1.1 XML 场景 `main.xml`。
- `type_probe.gd` 调用 `Node2D.new()`，打印实例类型以及它是否属于 `CanvasItem`、`Node`，随后释放实例并退出。
- 在本目录运行：

```sh
godot -path .
```

预期类型名为 `Node2D`，两个 `is_type()` 检查均为真。Godot 1.1 没有向 GDScript 暴露 `ObjectTypeDB` 查询单例；实验观察 `.new()` 与对象自身类型接口，注册表查询依据 C++ 静态源码。

## 简化与边界

只追踪内置 `Node2D` 的注册、继承和创建，不枚举所有模块类、不研究禁用类型和编辑器专有类型，也不把后续版本的 `ClassDB` API 套用到 Godot 1.1。本课依据静态源码，尚未运行实验。

## 下一课

继续阅读 [s09_method_property_binding](../s09_method_property_binding/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
