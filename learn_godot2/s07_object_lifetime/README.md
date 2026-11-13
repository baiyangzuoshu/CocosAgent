# 第 7 课：`Object` 实例 ID 与 `Reference` 引用计数

**目标：** 追踪 Godot 2.1 的对象注册/销毁路径，并比较普通 `Object` 显式释放与 `Reference` 最后一个引用释放。

## 本课问题

`ObjectDB` 如何登记实例 ID？`NOTIFICATION_PREDELETE` 在什么阶段发生？`Reference::unreference()` 如何影响对象实际析构？

## C++ 源码追踪

以下路径相对于 `engine/godot-2.1/` 快照根目录：

- `core/object.cpp:1718-1724`：`Object` 构造时注册到 `ObjectDB` 并分配 `get_instance_ID()`。
- `core/object.cpp:1739-1777`、`1793-1818`：析构时移除 ID；ObjectDB 保存 ID 到指针的映射并提供查找。
- `core/object.cpp:257-265`、`1536`、`1616`、`1620`：预删除通知先于实际销毁；脚本类型系统暴露实例 ID、`free()` 和 `_notification()`。
- `core/reference.cpp:65-80`：`Reference` 增减引用计数，并让脚本实例同步引用状态。
- `core/reference.h:281-304`：`Ref<T>` 释放一个强引用，只有 `unreference()` 返回可删除时才调用 `memdelete`。

## 最小实验

- `engine.cfg` 使用本代项目配置并指定 format 1 场景 `main.tscn`。
- 一个继承 `Object` 的脚本打印 ID/PREDELETE；另一个继承 `Reference`，由场景脚本创建两个变量指向同一实例并逐个置空。
- 在本目录运行：

```sh
godot -path .
```

预期普通 Object 调用 `free()` 后立即报告 PREDELETE。Reference 在第一个变量清空后仍存活，最后一个变量清空后才报告 PREDELETE。实例 ID 标识对象，不持有对象。

## 简化与边界

实验不覆盖 `WeakRef`、循环引用、线程安全策略和 Node 的 `queue_free()`。Godot 2.1 保留大写 `get_instance_ID()`、`ObjectTypeDB`、`Reference` 和文本场景格式；本课尚未运行。

## 本课 C++ 源码摘录

课内摘录保留对应 Godot 源码行段正文，并在段首标出原始行号；完整上下文以只读的 engine 快照为准。摘录用于追踪，不是独立编译单元。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | Godot 源文件 | 上游行段 |
| --- | --- | --- |
| [object.cpp](src/upstream/core/object.cpp.excerpt) | godot-2.1/core/object.cpp | 257-265, 1718-1724, 1739-1777 |
| [reference.cpp](src/upstream/core/reference.cpp.excerpt) | godot-2.1/core/reference.cpp | 65-80 |
| [reference.h](src/upstream/core/reference.h.excerpt) | godot-2.1/core/reference.h | 281-304 |
