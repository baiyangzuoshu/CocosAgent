# 第 8 课：`ClassDB` 类型注册与动态实例化

**目标：** 追踪 Godot 3.6 如何将 C++ 类、父类、方法、属性和创建函数登记到 `ClassDB`，并从 GDScript 动态创建原生对象。

## 本课问题

`register_class<T>()` 写入哪些类型信息？`class_exists()` 和 `can_instance()` 分别检查什么？`ClassDB.instance()` 怎样把登记的工厂结果交给 GDScript？

## 源码调用链

源码依据：`engine/godot-3.6/`（Godot 3.6 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-3.6/` 快照根目录：

- `scene/register_scene_types.cpp:250-287`、`594-599`：场景类型注册阶段登记 `Node`、抽象 `CanvasItem` 和具体 `Node2D`。
- `scene/2d/node_2d.h:37`：`Node2D` 以 `CanvasItem` 为父类。
- `core/class_db.h:165-181`：`register_class<T>()` 初始化类元数据，并保存 `creator<T>`、类指针和脚本可见状态。
- `core/class_db.cpp:491-494`、`501-534`：`class_exists()` 查登记表；`instance()` 检查禁用状态/创建函数并调用工厂；`can_instance()` 判断创建函数是否可用。
- `core/bind/core_bind.cpp:2949-2968`、`3115-3122`：脚本侧 `_ClassDB` 包装这些查询和 `instance()`；引用计数对象会包装为 `Reference`，普通对象作为 Object 返回。
- `scene/2d/node_2d.cpp:382-430`：`Node2D::_bind_methods()` 绑定 `set_position()` 等方法，并用 `ADD_PROPERTY` 将 `position` 映射到 setter/getter。
- `modules/gdscript/gdscript.cpp:60-78`：GDScript 原生类 `.new()` 同样经 `GDScriptNativeClass` 调用 `ClassDB::instance()`。
- `core/object.cpp:1673-1675`：`Object.is_class()` 暴露实例所属类及其父类检查。

调用摘要：C++ `register_scene_types()` 登记类 → ClassDB 保存构造工厂 → GDScript 查询类型是否存在/可创建 → `ClassDB.instance("Node2D")` 调用工厂并返回实例。

## 本课源码复刻

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-3.6` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [core_bind.cpp](src/upstream/core/bind/core_bind.cpp) | [摘录](src/upstream/core/bind/core_bind.cpp.excerpt) | `engine/godot-3.6/core/bind/core_bind.cpp` | 2949-2968 |
| 2 | [class_db.cpp](src/upstream/core/class_db.cpp) | [摘录](src/upstream/core/class_db.cpp.excerpt) | `engine/godot-3.6/core/class_db.cpp` | 491-494 |
| 3 | [class_db.h](src/upstream/core/class_db.h) | [摘录](src/upstream/core/class_db.h.excerpt) | `engine/godot-3.6/core/class_db.h` | 165-181 |
| 4 | [object.cpp](src/upstream/core/object.cpp) | [摘录](src/upstream/core/object.cpp.excerpt) | `engine/godot-3.6/core/object.cpp` | 1673-1675 |
| 5 | [gdscript.cpp](src/upstream/modules/gdscript/gdscript.cpp) | [摘录](src/upstream/modules/gdscript/gdscript.cpp.excerpt) | `engine/godot-3.6/modules/gdscript/gdscript.cpp` | 60-78 |
| 6 | [node_2d.cpp](src/upstream/scene/2d/node_2d.cpp) | [摘录](src/upstream/scene/2d/node_2d.cpp.excerpt) | `engine/godot-3.6/scene/2d/node_2d.cpp` | 382-430 |
| 7 | [node_2d.h](src/upstream/scene/2d/node_2d.h) | [摘录](src/upstream/scene/2d/node_2d.h.excerpt) | `engine/godot-3.6/scene/2d/node_2d.h` | 37-37 |
| 8 | [register_scene_types.cpp](src/upstream/scene/register_scene_types.cpp) | [摘录](src/upstream/scene/register_scene_types.cpp.excerpt) | `engine/godot-3.6/scene/register_scene_types.cpp` | 250-287 |

## 可运行源码复刻

课程代码 [`src/source_replay.gd`](src/source_replay.gd) 按本课 C++ 函数关系实现一个小型 GDScript 模型；入口脚本会先运行它，再执行下面的真实引擎 API 实验。阅读时把模型中的状态变化逐步映射到上方的 C++ 摘录。模型只复刻本课选出的路径，不声称等同于完整 Godot 引擎。

## 最小 Godot/GDScript 实验

- `project.godot` 使用 Godot 3.6 配置，主场景 `main.tscn` 为 format 2。
- `type_probe.gd` 依次查询 `Node2D` 存在性和可实例化状态，再用 `ClassDB.instance()` 创建实例；通过 `set_position()` 和 `position` 属性观察方法与属性绑定，并检查 `CanvasItem`、`Node` 父类关系。
- 在本目录运行：

```sh
godot --path .
```

预期前两项为真，实例的 `get_class()` 为 `Node2D`，两个 `is_class()` 检查也为真；设置后读回的位置为 `(12, 24)`。脚本手动释放对象并退出。

## 简化与边界

只检查一个内置 C++ 类，不枚举完整 ClassDB，也不讨论 GDNative 注册、编辑器类、脚本全局类和属性/方法绑定细节。Godot 3.6 使用 `ClassDB.instance()`；本课依据静态源码，尚未运行实验。

## 下一课

继续阅读 [s09_variant_dynamic_values](../s09_variant_dynamic_values/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
