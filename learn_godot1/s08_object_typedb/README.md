# 第 8 课：`ObjectTypeDB` 注册与原生类实例创建

**目标：** 追踪 Godot 1.1 如何登记原生类的父类关系和创建函数，并沿 GDScript 的 `Node2D.new()` 进入 `ObjectTypeDB` 创建对象。

## 本课增量

把类名登记、父类链接、工厂资格、抽象类拒绝和动态实例化写成可运行流程。

**本课要回答：** `register_scene_types()` 如何让 `Node2D` 成为已注册类型？`register_type<T>()` 保存了哪些实例创建信息？GDScript 的原生类 `.new()` 最终调用了什么？

## C++ 源码追踪

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

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [object.cpp](src/upstream/core/object.cpp) | [1435-1438](src/upstream/core/object.cpp.excerpt) | engine/godot-1.1/core/object.cpp |
| 2 | [object_type_db.cpp](src/upstream/core/object_type_db.cpp) | [272-296 ; 300-317](src/upstream/core/object_type_db.cpp.excerpt) | engine/godot-1.1/core/object_type_db.cpp |
| 3 | [object_type_db.h](src/upstream/core/object_type_db.h) | [195-204](src/upstream/core/object_type_db.h.excerpt) | engine/godot-1.1/core/object_type_db.h |
| 4 | [gd_script.cpp](src/upstream/modules/gdscript/gd_script.cpp) | [1422-1448](src/upstream/modules/gdscript/gd_script.cpp.excerpt) | engine/godot-1.1/modules/gdscript/gd_script.cpp |
| 5 | [node_2d.h](src/upstream/scene/2d/node_2d.h) | [34-36](src/upstream/scene/2d/node_2d.h.excerpt) | engine/godot-1.1/scene/2d/node_2d.h |
| 6 | [register_scene_types.cpp](src/upstream/scene/register_scene_types.cpp) | [231-266](src/upstream/scene/register_scene_types.cpp.excerpt) | engine/godot-1.1/scene/register_scene_types.cpp |

## GDScript 源码复刻

`src/source_replay.gd` 按本课列出的 C++ 入口重建关键数据结构、条件分支和状态更新。它是可逐步阅读的教学移植，不是完整引擎替身；模型函数表会标明直接对应的源码行为和仅用于组织输入/输出的脚手架。平台、线程、对象分配和服务器副作用仍由真实引擎处理。

| 模型函数 | C++ 源码对照或脚手架性质 | 复现的状态与分支 |
| --- | --- | --- |
| `_register_type()` | `ObjectTypeDB::_add_type2 / register_type` | 保存原生类型名、父类与创建能力元数据。 |
| `_can_create()` | `ObjectTypeDB::can_instance` | 检查类型已登记且有 creator。 |
| `_instance()` | `ObjectTypeDB::instance / GDNativeClass::instance` | 按类型表中的 creator 产生实例记录。 |
| `_inherits()` | `TypeInfo::inherits_ptr` | 沿类型父指针判断是否为目标祖先。 |

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
