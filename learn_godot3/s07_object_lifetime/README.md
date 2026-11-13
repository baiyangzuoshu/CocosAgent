# 第 7 课：`ObjectDB`、实例 ID 与 `Reference` 销毁

**目标：** 追踪 Godot 3.6 `Object` 的实例登记与预删除通知，并从 `Reference` 引用计数理解何时真正释放对象。

## 本课问题

对象 ID 由谁生成和移除？`NOTIFICATION_PREDELETE` 与 C++ 析构是什么顺序？当脚本变量共享一个 `Reference` 时，谁决定删除时机？

## C++ 源码追踪

以下路径相对于 `engine/godot-3.6/` 快照根目录：

- `core/object.cpp:1931-1952`：构造时向 `ObjectDB::add_instance()` 登记并分配 `ObjectID`；`core/object.h:604` 暴露 `get_instance_id()`。
- `core/object.cpp:388-395`、`1954-2005`、`2015-2047`：预删除阶段发送 `NOTIFICATION_PREDELETE`，随后析构并从 ObjectDB 移除 ID；ObjectDB 保存和查询实例映射。
- `core/reference.cpp:57-96`：`Reference::reference/unreference()` 更新引用数并同步脚本引用状态。
- `core/reference.h:252-273`：`Ref<T>` 在最后引用释放时调用 `memdelete`。
- `core/object.cpp:1747`：Object 类型注册了脚本可调用的虚拟 `free()` 方法。

## 最小实验

- `project.godot` 使用 Godot 3.6 配置，主场景为 `main.tscn`。
- `manual_object.gd` 继承 `Object` 并显式调用 `free()`；`reference_probe.gd` 继承 `Reference`，主脚本用两个变量持有它并逐个清空。
- 在本目录运行：

```sh
godot --path .
```

观察两个对象各自打印的 ID 和 PREDELETE。普通 Object 在显式 `free()` 时释放；Reference 在最后一个变量清空时释放。实例 ID 不会延长对象生命。

## 简化与边界

不演示 `WeakRef`、引用循环、脚本实例绑定计数或多线程析构。Godot 3.6 使用 `Reference`、`ObjectID`、`ClassDB` 与 GDScript `free()` 虚方法；本课尚未运行。

## 本课 C++ 源码摘录

课内摘录保留对应 Godot 源码行段正文，并在段首标出原始行号；完整上下文以只读的 engine 快照为准。摘录用于追踪，不是独立编译单元。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | Godot 源文件 | 上游行段 |
| --- | --- | --- |
| [object.cpp](src/upstream/core/object.cpp.excerpt) | godot-3.6/core/object.cpp | 388-395, 1747-1747, 1931-1952 |
| [object.h](src/upstream/core/object.h.excerpt) | godot-3.6/core/object.h | 604-604 |
| [reference.cpp](src/upstream/core/reference.cpp.excerpt) | godot-3.6/core/reference.cpp | 57-96 |
| [reference.h](src/upstream/core/reference.h.excerpt) | godot-3.6/core/reference.h | 252-273 |
