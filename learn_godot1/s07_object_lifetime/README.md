# 第 7 课：`Object` ID、显式释放与 `Reference` 生命周期

**目标：** 追踪 Godot 1.1 对象如何注册到 `ObjectDB` 并取得实例 ID，以及 `Reference` 如何用引用计数决定何时删除。

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

## 可运行源码复刻

课程代码 [`src/source_replay.gd`](src/source_replay.gd) 按本课 C++ 函数关系实现一个小型 GDScript 模型；入口脚本会先运行它，再执行下面的真实引擎 API 实验。阅读时把模型中的状态变化逐步映射到上方的 C++ 摘录。模型只复刻本课选出的路径，不声称等同于完整 Godot 引擎。

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
