# 第 7 课：`Object` 实例 ID 与 `Reference` 引用计数

**目标：** 追踪 Godot 2.1 的对象注册/销毁路径，并比较普通 `Object` 显式释放与 `Reference` 最后一个引用释放。

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

## 可运行源码复刻

课程代码 [`src/source_replay.gd`](src/source_replay.gd) 按本课 C++ 函数关系实现一个小型 GDScript 模型；入口脚本会先运行它，再执行下面的真实引擎 API 实验。阅读时把模型中的状态变化逐步映射到上方的 C++ 摘录。模型只复刻本课选出的路径，不声称等同于完整 Godot 引擎。

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
