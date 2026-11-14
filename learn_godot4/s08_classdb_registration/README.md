# 第 8 课：`ClassDB` 类型注册与动态实例化

**目标：** 追踪 Godot 4.7 如何登记 C++ 类、方法、属性和创建函数，并使用 GDScript `ClassDB` 查询和动态实例化一个内置类。

## 本课增量

把类名登记、父类链接、工厂资格、抽象类拒绝和动态实例化写成可运行流程。

**本课要回答：** `GDREGISTER_CLASS` 最终如何建立类型信息与创建函数？`class_exists()` 和 `can_instantiate()` 的判断有什么边界？`instantiate()` 怎样返回一个脚本可用对象？

## C++ 源码追踪

源码依据：`engine/godot-4.7/`（Godot 4.7 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-4.7/` 快照根目录：

- `scene/register_scene_types.cpp:390-442`、`790-794`：场景注册阶段将 `Node`、抽象 `CanvasItem` 和 `Node2D` 登记到 ClassDB。
- `scene/2d/node_2d.h:35-36`：`Node2D` 继承 `CanvasItem`。
- `core/object/class_db.h:244-257`、`568-578`：`register_class<T>()` 初始化类型元数据并保存创建函数；抽象类注册只登记类型而不登记实例创建函数。
- `core/object/class_db.cpp:525-528`、`658-699`：`class_exists()` 查表；内部可创建判断检查可见性、禁用状态和创建接口；`instantiate()` 进入 ClassDB 的实例构造路径。
- `core/object/class_db.cpp:842-865`：`can_instantiate()` 对原生 ClassDB 类型检查创建能力；对全局脚本类则解析脚本并检查有效性/抽象状态。
- `core/core_bind.cpp:1599-1623`、`1838-1845`：脚本侧 `ClassDB` 将查询和实例化请求转交 C++ ClassDB；返回的 `Variant` 对 RefCounted 作引用包装，其他对象作为 Object 返回。
- `scene/2d/node_2d.cpp:461-504`：`Node2D::_bind_methods()` 绑定 `set_position()` 等方法，并用 `ADD_PROPERTY` 将 `position` 映射到 setter/getter。
- `core/object/object.cpp:1837-1839`：`Object.is_class()` 绑定给 GDScript，用于检查实例类及其父类。

调用摘要：场景注册调用 `GDREGISTER_CLASS(Node2D)` → ClassDB 保存其类型信息和 creator → GDScript 查询类型/可创建状态 → `ClassDB.instantiate("Node2D")` 创建并返回对象。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [core_bind.cpp](src/upstream/core/core_bind.cpp) | [1599-1623](src/upstream/core/core_bind.cpp.excerpt) | engine/godot-4.7/core/core_bind.cpp |
| 2 | [class_db.cpp](src/upstream/core/object/class_db.cpp) | [525-528 ; 842-865](src/upstream/core/object/class_db.cpp.excerpt) | engine/godot-4.7/core/object/class_db.cpp |
| 3 | [class_db.h](src/upstream/core/object/class_db.h) | [244-257](src/upstream/core/object/class_db.h.excerpt) | engine/godot-4.7/core/object/class_db.h |
| 4 | [object.cpp](src/upstream/core/object/object.cpp) | [1837-1839](src/upstream/core/object/object.cpp.excerpt) | engine/godot-4.7/core/object/object.cpp |
| 5 | [node_2d.cpp](src/upstream/scene/2d/node_2d.cpp) | [461-504](src/upstream/scene/2d/node_2d.cpp.excerpt) | engine/godot-4.7/scene/2d/node_2d.cpp |
| 6 | [node_2d.h](src/upstream/scene/2d/node_2d.h) | [35-36](src/upstream/scene/2d/node_2d.h.excerpt) | engine/godot-4.7/scene/2d/node_2d.h |
| 7 | [register_scene_types.cpp](src/upstream/scene/register_scene_types.cpp) | [390-442](src/upstream/scene/register_scene_types.cpp.excerpt) | engine/godot-4.7/scene/register_scene_types.cpp |

## GDScript 源码复刻

S08 Godot 4.7: ClassDB::instantiate uses registered creation info and abstract flags.

source_replay.gd 按本课指定快照复刻控制流与状态传递，模型中的状态字段、函数入口和 API 名称对应本代 C++ 路径。根目录实验脚本先运行模型，再调用对应版本的 Godot API。

| GDScript 函数 | 复刻步骤 |
| --- | --- |
| _register_class() | 将类型名、父类和创建资格写入类型表 |
| _can_instantiate() | 检查类型父链、创建工厂或是否可实例化 |
| _instantiate() | 从共享 PackedScene 描述创建独立节点实例 |
| _is_class() | 检查类型父链、创建工厂或是否可实例化 |

## 最小 Godot/GDScript 实验

- `project.godot` 使用 Godot 4.7 配置，主场景 `main.tscn` 为 format 3。
- `type_probe.gd` 查询 `Node2D` 是否已登记、是否可实例化；随后动态实例化，通过 `set_position()` 和 `position` 属性观察方法/属性绑定，并检查它是否属于 `CanvasItem` 与 `Node`。
- 在本目录运行：

```sh
godot --path .
```

预期两个 ClassDB 查询为真，动态实例类型为 `Node2D`，两个 `is_class()` 检查为真；设置后读回的位置为 `(12, 24)`。脚本释放实例并退出。

## 简化与边界

实验只检查内置 Node2D，不覆盖 GDExtension 类创建回调、全局脚本类的加载分支、编辑器类型或抽象类实例化失败路径。Godot 4.7 使用 `can_instantiate()` 和 `instantiate()`；Godot 3 的 `can_instance()` / `instance()` 命名不沿用到本代。本课依据静态源码，尚未运行实验。

## 下一课

继续阅读 [s09_variant_values](../s09_variant_values/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
