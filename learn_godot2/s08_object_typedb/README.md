# 第 8 课：`ObjectTypeDB` 注册、继承与实例化

**目标：** 追踪 Godot 2.1 的原生类注册信息和实例工厂，再从 GDScript 的 `Node2D.new()` 进入 `ObjectTypeDB::instance()`。

## 本课问题

类名和父类关系在何时登记？哪些元数据决定一个类型能否创建？GDScript 的 `type_exists()`、`is_type()` 与 `.new()` 分别观察了哪一层？

## 源码调用链

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

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-2.1` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [object.cpp](src/upstream/core/object.cpp) | [摘录](src/upstream/core/object.cpp.excerpt) | `engine/godot-2.1/core/object.cpp` | 1527-1531 |
| 2 | [object_type_db.cpp](src/upstream/core/object_type_db.cpp) | [摘录](src/upstream/core/object_type_db.cpp.excerpt) | `engine/godot-2.1/core/object_type_db.cpp` | 269-294, 296-317 |
| 3 | [object_type_db.h](src/upstream/core/object_type_db.h) | [摘录](src/upstream/core/object_type_db.h.excerpt) | `engine/godot-2.1/core/object_type_db.h` | 192-201 |
| 4 | [gd_functions.cpp](src/upstream/modules/gdscript/gd_functions.cpp) | [摘录](src/upstream/modules/gdscript/gd_functions.cpp.excerpt) | `engine/godot-2.1/modules/gdscript/gd_functions.cpp` | 92-92 |
| 5 | [gd_script.cpp](src/upstream/modules/gdscript/gd_script.cpp) | [摘录](src/upstream/modules/gdscript/gd_script.cpp.excerpt) | `engine/godot-2.1/modules/gdscript/gd_script.cpp` | 64-87 |
| 6 | [node_2d.h](src/upstream/scene/2d/node_2d.h) | [摘录](src/upstream/scene/2d/node_2d.h.excerpt) | `engine/godot-2.1/scene/2d/node_2d.h` | 36-38 |
| 7 | [register_scene_types.cpp](src/upstream/scene/register_scene_types.cpp) | [摘录](src/upstream/scene/register_scene_types.cpp.excerpt) | `engine/godot-2.1/scene/register_scene_types.cpp` | 240-294 |

## 可运行源码复刻

课程代码 [`src/source_replay.gd`](src/source_replay.gd) 按本课 C++ 函数关系实现一个小型 GDScript 模型；入口脚本会先运行它，再执行下面的真实引擎 API 实验。阅读时把模型中的状态变化逐步映射到上方的 C++ 摘录。模型只复刻本课选出的路径，不声称等同于完整 Godot 引擎。

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
