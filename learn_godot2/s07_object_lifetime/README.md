# 第 7 课：`Object` 实例 ID 与 `Reference` 引用计数

**目标：** 追踪 Godot 2.1 的对象注册/销毁路径，并比较普通 `Object` 显式释放与 `Reference` 最后一个引用释放。

## 本课增量

用 ObjectDB 实例 ID 表对比普通 Object 显式 free 与引用计数对象最后一次 unref。

**本课要回答：** `ObjectDB` 如何登记实例 ID？`NOTIFICATION_PREDELETE` 在什么阶段发生？`Reference::unreference()` 如何影响对象实际析构？

## C++ 源码追踪

源码依据：`engine/godot-2.1/`（Godot 2.1 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-2.1/` 快照根目录：

- `core/object.cpp:1718-1724`：`Object` 构造时注册到 `ObjectDB` 并分配 `get_instance_ID()`。
- `core/object.cpp:1739-1777`、`1793-1818`：析构时移除 ID；ObjectDB 保存 ID 到指针的映射并提供查找。
- `core/object.cpp:257-265`、`1536`、`1616`、`1620`：预删除通知先于实际销毁；脚本类型系统暴露实例 ID、`free()` 和 `_notification()`。
- `core/reference.cpp:65-80`：`Reference` 增减引用计数，并让脚本实例同步引用状态。
- `core/reference.h:281-304`：`Ref<T>` 释放一个强引用，只有 `unreference()` 返回可删除时才调用 `memdelete`。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [object.cpp](src/upstream/core/object.cpp) | [257-265 ; 1718-1724 ; 1739-1777](src/upstream/core/object.cpp.excerpt) | engine/godot-2.1/core/object.cpp |
| 2 | [reference.cpp](src/upstream/core/reference.cpp) | [65-80](src/upstream/core/reference.cpp.excerpt) | engine/godot-2.1/core/reference.cpp |
| 3 | [reference.h](src/upstream/core/reference.h) | [281-304](src/upstream/core/reference.h.excerpt) | engine/godot-2.1/core/reference.h |

## GDScript 源码复刻

S07 Godot 2.1: ObjectDB lifetime is explicit for Object, refcount-driven for Reference.

source_replay.gd 按本课指定快照复刻控制流与状态传递，模型中的状态字段、函数入口和 API 名称对应本代 C++ 路径。根目录实验脚本先运行模型，再调用对应版本的 Godot API。

| GDScript 函数 | 复刻步骤 |
| --- | --- |
| _register() | 按实例 ID/ObjectID 查询对象数据库 |
| _lookup() | 按实例 ID/ObjectID 查询对象数据库 |
| _remove() | 移除 ObjectDB 项或更新引用计数直到销毁 |
| _ref() | 移除 ObjectDB 项或更新引用计数直到销毁 |
| _unref() | 移除 ObjectDB 项或更新引用计数直到销毁 |

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
