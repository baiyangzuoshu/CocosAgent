# 第 8 课：`ObjectTypeDB` 注册、继承与实例化

**目标：** 追踪 Godot 2.1 的原生类注册信息和实例工厂，再从 GDScript 的 `Node2D.new()` 进入 `ObjectTypeDB::instance()`。

## 本课增量

把类名登记、父类链接、工厂资格、抽象类拒绝和动态实例化写成可运行流程。

**本课要回答：** 类名和父类关系在何时登记？哪些元数据决定一个类型能否创建？GDScript 的 `type_exists()`、`is_type()` 与 `.new()` 分别观察了哪一层？

## C++ 源码追踪

源码依据：`engine/godot-2.1/`（Godot 2.1 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-2.1/` 快照根目录：

- `scene/register_scene_types.cpp:240-294`、`473-476`：场景注册函数登记 `Node`、虚类型 `CanvasItem` 与可实例化的 `Node2D`。
- `scene/2d/node_2d.h:36-38`：`Node2D` 继承 `CanvasItem`。
- `core/object_type_db.cpp:296-317`：ObjectTypeDB 记录类型名、父类及父类元数据指针。
- `core/object_type_db.h:192-201`：`register_type<T>()` 初始化类并写入对应 C++ 创建函数。
- `core/object_type_db.cpp:269-294`：`instance()` 校验类型可用性后调用工厂；`can_instance()` 检查类型是否有可用工厂。
- `modules/gdscript/gd_script.cpp:64-87`：GDScript 原生类 `.new()` 经过 `GDNativeClass::_new()` / `instance()` 创建对象。
- `modules/gdscript/gd_functions.cpp:92`、`530-534`：GDScript 全局 `type_exists()` 查询 ObjectTypeDB 的类型表。
- `core/object.cpp:1527-1531`：`get_type()`、`is_type()` 作为 Object 方法绑定给脚本。

调用摘要：`register_scene_types()` 登记 C++ 类 → 类型表持有继承元数据和工厂函数 → `Node2D.new()` 选择工厂创建实例；`type_exists()` 只检查类名是否存在，不保证该类型可实例化。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [object.cpp](src/upstream/core/object.cpp) | [1527-1531](src/upstream/core/object.cpp.excerpt) | engine/godot-2.1/core/object.cpp |
| 2 | [object_type_db.cpp](src/upstream/core/object_type_db.cpp) | [269-294 ; 296-317](src/upstream/core/object_type_db.cpp.excerpt) | engine/godot-2.1/core/object_type_db.cpp |
| 3 | [object_type_db.h](src/upstream/core/object_type_db.h) | [192-201](src/upstream/core/object_type_db.h.excerpt) | engine/godot-2.1/core/object_type_db.h |
| 4 | [gd_functions.cpp](src/upstream/modules/gdscript/gd_functions.cpp) | [92-92](src/upstream/modules/gdscript/gd_functions.cpp.excerpt) | engine/godot-2.1/modules/gdscript/gd_functions.cpp |
| 5 | [gd_script.cpp](src/upstream/modules/gdscript/gd_script.cpp) | [64-87](src/upstream/modules/gdscript/gd_script.cpp.excerpt) | engine/godot-2.1/modules/gdscript/gd_script.cpp |
| 6 | [node_2d.h](src/upstream/scene/2d/node_2d.h) | [36-38](src/upstream/scene/2d/node_2d.h.excerpt) | engine/godot-2.1/scene/2d/node_2d.h |
| 7 | [register_scene_types.cpp](src/upstream/scene/register_scene_types.cpp) | [240-294](src/upstream/scene/register_scene_types.cpp.excerpt) | engine/godot-2.1/scene/register_scene_types.cpp |

## GDScript 源码复刻

`src/source_replay.gd` 按本课列出的 C++ 入口重建关键数据结构、条件分支和状态更新。它是可逐步阅读的教学移植，不是完整引擎替身；模型函数表会标明直接对应的源码行为和仅用于组织输入/输出的脚手架。平台、线程、对象分配和服务器副作用仍由真实引擎处理。

| 模型函数 | C++ 源码对照或脚手架性质 | 复现的状态与分支 |
| --- | --- | --- |
| `_register_type()` | `ObjectTypeDB::_add_type2 / register_type` | 保存原生类型名、父类与创建能力元数据。 |
| `_can_instance()` | `ObjectTypeDB::can_instance` | 检查类型表与原生 creator 是否允许实例化。 |
| `_instance()` | `ObjectTypeDB::instance / GDNativeClass::instance` | 按类型表中的 creator 产生实例记录。 |
| `_parent_chain()` | `TypeInfo::inherits_ptr` | 沿父类元数据逐级读取继承关系。 |

## 最小 Godot/GDScript 实验

- `engine.cfg` 使用 Godot 2.1 项目配置，主场景 `main.tscn` 为 format 1 文本场景。
- `type_probe.gd` 用 `type_exists("Node2D")` 检查登记状态，再创建 `Node2D` 并检查 `CanvasItem`、`Node` 祖先关系。
- 在本目录运行：

```sh
godot -path .
```

预期 `type_exists()` 和两个 `is_type()` 均为真，`get_type()` 输出 `Node2D`。最后脚本释放实例并退出。

## 简化与边界

只使用场景内置类，不覆盖模块按编译选项增删类型、兼容类型回退或 ObjectTypeDB 的方法/属性绑定。Godot 2.1 使用 `ObjectTypeDB`、`ObjectTypeDB::instance()` 和 GDScript 全局 `type_exists()`；本课依据静态源码，尚未运行实验。

## 下一课

继续阅读 [s09_method_property_bindings](../s09_method_property_bindings/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
