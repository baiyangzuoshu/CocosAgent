# 第 7 课：`Object` ID、显式释放与 `Reference` 生命周期

**目标：** 追踪 Godot 1.1 对象如何注册到 `ObjectDB` 并取得实例 ID，以及 `Reference` 如何用引用计数决定何时删除。

## 本课增量

用 ObjectDB 实例 ID 表对比普通 Object 显式 free 与引用计数对象最后一次 unref。

## 本课问题

普通 `Object` 和 `Reference` 的释放责任有什么不同？对象 ID 在何时登记、何时从 `ObjectDB` 移除？最后一个引用释放时会发生什么？

## 源码调用链

源码依据：`engine/godot-1.1/`（Godot 1.1 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-1.1/` 快照根目录：

- `core/object.cpp:1608-1614`：`Object` 构造时由 `ObjectDB::add_instance()` 登记对象并分配 `get_instance_ID()`。
- `core/object.cpp:1632-1673`、`1692-1717`：析构时从 ObjectDB 移除 ID；ObjectDB 保存 ID 到对象指针的映射并提供查询。
- `core/object.cpp:256-260`：实际删除前调用 `NOTIFICATION_PREDELETE`；`1443`、`1526`、`1530` 将 ID、脚本 `free()` 和 `_notification()` 暴露给脚本类型系统。
- `core/reference.cpp:66-80`：`Reference` 增减 `SafeRefCount`。
- `core/reference.h:285-305`：C++ `Ref<T>` 在释放持有项时调用 `unreference()`；计数归零后才 `memdelete` 对象。

## 本课源码复刻

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-1.1` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [object.cpp](src/upstream/core/object.cpp) | [摘录](src/upstream/core/object.cpp.excerpt) | `engine/godot-1.1/core/object.cpp` | 256-260, 1608-1614, 1632-1673 |
| 2 | [reference.cpp](src/upstream/core/reference.cpp) | [摘录](src/upstream/core/reference.cpp.excerpt) | `engine/godot-1.1/core/reference.cpp` | 66-80 |
| 3 | [reference.h](src/upstream/core/reference.h) | [摘录](src/upstream/core/reference.h.excerpt) | `engine/godot-1.1/core/reference.h` | 285-305 |

## GDScript 源码复刻与 C++ 对照

模型维护 ObjectDB 风格的实例 ID 表，分别执行普通 Object 显式 free 与 Reference/RefCounted 最后一个引用归零的销毁路径。

src/upstream/ 保存本课引用的完整上游文件副本和带原始行号的摘录；src/source_replay.gd 执行表中的教学模型。先观察模型如何改变状态或走分支，再回到对应 C++ 函数核对。模型不替代 C++，也不代表引擎运行时本身。

| C++ 追踪阶段 | 模型函数 | 运行时要观察什么 |
| --- | --- | --- |
| ObjectDB registration | _objectdb_insert() / _objectdb_get() | 分配实例 ID 并按 ID 查找对象 |
| Object::free() | _objectdb_erase() | 普通 Object 显式释放并注销 |
| Reference/RefCounted ref/unref | _reference() / _unreference() | 最后一个所有者归零后销毁 |

独立项目入口先调用 source_replay.gd，再执行真实 Godot API 实验。实验脚本：lifetime_probe.gd, manual_object.gd, reference_probe.gd。模型输出是确定性的教学数据；只有实际用对应版本 Godot 运行后，才能记录为引擎实验验证。

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
