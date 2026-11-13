# 第 8 课：`ObjectTypeDB` 注册与原生类实例创建

**目标：** 追踪 Godot 1.1 如何登记原生类的父类关系和创建函数，并沿 GDScript 的 `Node2D.new()` 进入 `ObjectTypeDB` 创建对象。

## 本课问题

`register_scene_types()` 如何让 `Node2D` 成为已注册类型？`register_type<T>()` 保存了哪些实例创建信息？GDScript 的原生类 `.new()` 最终调用了什么？

## C++ 源码追踪

以下路径相对于 `engine/godot-1.1/` 快照根目录：

- `scene/register_scene_types.cpp:231-266`、`463-466`：场景类型注册阶段登记 `Node`、虚类型 `CanvasItem` 和可实例化的 `Node2D`。
- `scene/2d/node_2d.h:34-36`：`Node2D` 的 C++ 继承关系为 `CanvasItem`。
- `core/object_type_db.cpp:300-317`：类型元数据保存类型名和已登记的父类。
- `core/object_type_db.h:195-204`：`register_type<T>()` 初始化类型，并将 `creator<T>` 保存为实例工厂；虚类型只初始化类型信息，不提供创建函数。
- `core/object_type_db.cpp:272-296`：`instance()` 检查类型状态与创建函数后调用工厂；`can_instance()` 根据同一注册信息判断是否可创建。
- `modules/gdscript/gd_script.cpp:1422-1448`：GDScript 原生类的 `.new()` 调用 `GDNativeClass::instance()`，后者转入 `ObjectTypeDB::instance()`。
- `core/object.cpp:1435-1438`：脚本可通过 `get_type()` 和 `is_type()` 观察实例类型与祖先关系。

调用摘要：场景启动注册原生类型 → 注册模板记录构造工厂 → GDScript `Node2D.new()` 找到对应原生类型对象 → 工厂创建 C++ `Node2D` 实例。

## 最小实验

- `engine.cfg` 指向 Godot 1.1 XML 场景 `main.xml`。
- `type_probe.gd` 调用 `Node2D.new()`，打印实例类型以及它是否属于 `CanvasItem`、`Node`，随后释放实例并退出。
- 在本目录运行：

```sh
godot -path .
```

预期类型名为 `Node2D`，两个 `is_type()` 检查均为真。Godot 1.1 没有向 GDScript 暴露 `ObjectTypeDB` 查询单例；实验观察 `.new()` 与对象自身类型接口，注册表查询依据 C++ 静态源码。

## 简化与边界

只追踪内置 `Node2D` 的注册、继承和创建，不枚举所有模块类、不研究禁用类型和编辑器专有类型，也不把后续版本的 `ClassDB` API 套用到 Godot 1.1。本课依据静态源码，尚未运行实验。

## 本课 C++ 源码摘录

课内摘录保留对应 Godot 源码行段正文，并在段首标出原始行号；完整上下文以只读的 engine 快照为准。摘录用于追踪，不是独立编译单元。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | Godot 源文件 | 上游行段 |
| --- | --- | --- |
| [object.cpp](src/upstream/core/object.cpp.excerpt) | godot-1.1/core/object.cpp | 1435-1438 |
| [object_type_db.cpp](src/upstream/core/object_type_db.cpp.excerpt) | godot-1.1/core/object_type_db.cpp | 272-296, 300-317 |
| [object_type_db.h](src/upstream/core/object_type_db.h.excerpt) | godot-1.1/core/object_type_db.h | 195-204 |
| [gd_script.cpp](src/upstream/modules/gdscript/gd_script.cpp.excerpt) | godot-1.1/modules/gdscript/gd_script.cpp | 1422-1448 |
| [node_2d.h](src/upstream/scene/2d/node_2d.h.excerpt) | godot-1.1/scene/2d/node_2d.h | 34-36 |
| [register_scene_types.cpp](src/upstream/scene/register_scene_types.cpp.excerpt) | godot-1.1/scene/register_scene_types.cpp | 231-266 |
