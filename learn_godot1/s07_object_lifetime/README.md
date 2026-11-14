# 第 7 课：`Object` ID、显式释放与 `Reference` 生命周期

**目标：** 追踪 Godot 1.1 对象如何注册到 `ObjectDB` 并取得实例 ID，以及 `Reference` 如何用引用计数决定何时删除。

## 本课增量

用 ObjectDB 实例 ID 表对比普通 Object 显式 free 与引用计数对象最后一次 unref。

**本课要回答：** 普通 `Object` 和 `Reference` 的释放责任有什么不同？对象 ID 在何时登记、何时从 `ObjectDB` 移除？最后一个引用释放时会发生什么？

## C++ 源码追踪

源码依据：`engine/godot-1.1/`（Godot 1.1 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-1.1/` 快照根目录：

- `core/object.cpp:1608-1614`：`Object` 构造时由 `ObjectDB::add_instance()` 登记对象并分配 `get_instance_ID()`。
- `core/object.cpp:1632-1673`、`1692-1717`：析构时从 ObjectDB 移除 ID；ObjectDB 保存 ID 到对象指针的映射并提供查询。
- `core/object.cpp:256-260`：实际删除前调用 `NOTIFICATION_PREDELETE`；`1443`、`1526`、`1530` 将 ID、脚本 `free()` 和 `_notification()` 暴露给脚本类型系统。
- `core/reference.cpp:66-80`：`Reference` 增减 `SafeRefCount`。
- `core/reference.h:285-305`：C++ `Ref<T>` 在释放持有项时调用 `unreference()`；计数归零后才 `memdelete` 对象。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [object.cpp](src/upstream/core/object.cpp) | [256-260 ; 1608-1614 ; 1632-1673](src/upstream/core/object.cpp.excerpt) | engine/godot-1.1/core/object.cpp |
| 2 | [reference.cpp](src/upstream/core/reference.cpp) | [66-80](src/upstream/core/reference.cpp.excerpt) | engine/godot-1.1/core/reference.cpp |
| 3 | [reference.h](src/upstream/core/reference.h) | [285-305](src/upstream/core/reference.h.excerpt) | engine/godot-1.1/core/reference.h |

## GDScript 源码复刻

`src/source_replay.gd` 按本课列出的 C++ 入口重建关键数据结构、条件分支和状态更新。它是可逐步阅读的教学移植，不是完整引擎替身；模型函数表会标明直接对应的源码行为和仅用于组织输入/输出的脚手架。平台、线程、对象分配和服务器副作用仍由真实引擎处理。

| 模型函数 | C++ 源码对照或脚手架性质 | 复现的状态与分支 |
| --- | --- | --- |
| `_construct()` | `Object::Object / ObjectDB::add_instance` | 按目标 Variant 类型匹配构造或转换路径。 |
| `_lookup()` | `ObjectDB::get_instance` | 根据对象 ID 查询当前登记实例。 |
| `_remove()` | `Object::~Object / ObjectDB::remove_instance` | 从对象表删除实例登记。 |
| `_ref()` | `Reference::reference` | 增加 Reference/RefCounted 强引用计数。 |
| `_unref()` | `Reference::unreference` | 释放一个强引用；计数归零时移除对象。 |

## 最小 Godot/GDScript 实验

- `engine.cfg` 指向本目录的 Godot 1.1 XML 场景 `main.xml`。
- `manual_object.gd` 继承 `Object`，打印实例 ID 和 `NOTIFICATION_PREDELETE`。
- `reference_probe.gd` 继承 `Reference`；`lifetime_probe.gd` 先显式调用普通对象的 `free()`，再把一个 Reference 存入两个变量并逐个清空。
- 在本目录运行：

```sh
godot -path .
```

预期普通对象在调用 `free()` 时先报告 PREDELETE；Reference 在清空第一个变量后仍存活，清空第二个变量后报告 PREDELETE。ID 只用于标识实例，不是对象所有权。

## 简化与边界

实验不查询 ObjectDB 内部映射，也不讨论循环引用、跨线程引用或 Node 的场景树所有权。Godot 1.1 使用 `get_instance_ID()`、`Reference`、`ObjectTypeDB` 和 `SafeRefCount`；本课尚未运行。

## 下一课

继续阅读 [s08_object_typedb](../s08_object_typedb/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
