# 第 7 课：`Object` 实例 ID 与 `Reference` 引用计数

**目标：** 追踪 Godot 2.1 的对象注册/销毁路径，并比较普通 `Object` 显式释放与 `Reference` 最后一个引用释放。

## 本课增量

用 ObjectDB 实例 ID 表对比普通 Object 显式 free 与引用计数对象最后一次 unref。

## 本课问题

`ObjectDB` 如何登记实例 ID？`NOTIFICATION_PREDELETE` 在什么阶段发生？`Reference::unreference()` 如何影响对象实际析构？

## 源码调用链

源码依据：`engine/godot-2.1/`（Godot 2.1 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-2.1/` 快照根目录：

- `core/object.cpp:1718-1724`：`Object` 构造时注册到 `ObjectDB` 并分配 `get_instance_ID()`。
- `core/object.cpp:1739-1777`、`1793-1818`：析构时移除 ID；ObjectDB 保存 ID 到指针的映射并提供查找。
- `core/object.cpp:257-265`、`1536`、`1616`、`1620`：预删除通知先于实际销毁；脚本类型系统暴露实例 ID、`free()` 和 `_notification()`。
- `core/reference.cpp:65-80`：`Reference` 增减引用计数，并让脚本实例同步引用状态。
- `core/reference.h:281-304`：`Ref<T>` 释放一个强引用，只有 `unreference()` 返回可删除时才调用 `memdelete`。

## 本课源码复刻

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-2.1` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [object.cpp](src/upstream/core/object.cpp) | [摘录](src/upstream/core/object.cpp.excerpt) | `engine/godot-2.1/core/object.cpp` | 257-265, 1718-1724, 1739-1777 |
| 2 | [reference.cpp](src/upstream/core/reference.cpp) | [摘录](src/upstream/core/reference.cpp.excerpt) | `engine/godot-2.1/core/reference.cpp` | 65-80 |
| 3 | [reference.h](src/upstream/core/reference.h) | [摘录](src/upstream/core/reference.h.excerpt) | `engine/godot-2.1/core/reference.h` | 281-304 |

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

- `engine.cfg` 使用本代项目配置并指定 format 1 场景 `main.tscn`。
- 一个继承 `Object` 的脚本打印 ID/PREDELETE；另一个继承 `Reference`，由场景脚本创建两个变量指向同一实例并逐个置空。
- 在本目录运行：

```sh
godot -path .
```

预期普通 Object 调用 `free()` 后立即报告 PREDELETE。Reference 在第一个变量清空后仍存活，最后一个变量清空后才报告 PREDELETE。实例 ID 标识对象，不持有对象。

## 简化与边界

实验不覆盖 `WeakRef`、循环引用、线程安全策略和 Node 的 `queue_free()`。Godot 2.1 保留大写 `get_instance_ID()`、`ObjectTypeDB`、`Reference` 和文本场景格式；本课尚未运行。

## 下一课

继续阅读 [s08_object_typedb](../s08_object_typedb/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
