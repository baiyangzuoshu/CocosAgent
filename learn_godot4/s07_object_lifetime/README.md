# 第 7 课：`ObjectID` 与 `RefCounted` 生命周期

**目标：** 追踪 Godot 4.7 的 `ObjectDB` ID、预删除和引用计数路径，比较普通 `Object` 与 `RefCounted` 的释放方式。

## 本课问题

`ObjectID` 如何区分复用的对象槽？`RefCounted` 的最后一次 unreference 如何触发析构？`NOTIFICATION_PREDELETE` 与 ID 移除处于什么阶段？

## C++ 源码追踪

以下路径相对于 `engine/godot-4.7/` 快照根目录：

- `core/object/object.cpp:2284-2295`：`Object` 构造时设置引用标记并向 ObjectDB 登记实例 ID。
- `core/object/object.cpp:2451-2492`、`2495-2518`：ObjectDB 使用 slot、validator 和 refcount 标记编码 ID，并在移除实例时回收槽位。
- `core/object/object.cpp:171-185`、`1849`：删除前发送 `NOTIFICATION_PREDELETE`；`get_instance_id()` 公开给脚本。
- `core/object/ref_counted.cpp:74-126`：`RefCounted::reference/unreference()` 更新原子引用数，并判定是否达到删除条件。
- `core/object/ref_counted.h:199-228`：`Ref<T>` 在最后一次 unreference 后 `memdelete` 对象。
- `core/object/object.cpp:1920`：Object 类把脚本 `free()` 声明为虚方法，供普通 Object 显式释放。

## 最小实验

- `project.godot` 指定 `main.tscn`。
- `manual_object.gd` 继承 `Object` 并显式 `free()`；`reference_probe.gd` 继承 `RefCounted`，由两个脚本变量共享后逐个清空。
- 在本目录运行：

```sh
godot --path .
```

预期先看到普通 Object 的 PREDELETE，再看到 RefCounted 的 ID。清空第一个变量时 RefCounted 继续存活；清空最后一个变量时它才报告 PREDELETE。slot/validator 的编码细节由 C++ 源码确认。

## 简化与边界

不直接操作 `ObjectID` 位域，不演示 `WeakRef`、引用循环或多线程销毁。Godot 4.7 将 `Reference` 更名为 `RefCounted`，并使用带 validator 的 ObjectDB 槽位；本课未运行。

## 本课 C++ 源码摘录

课内摘录保留对应 Godot 源码行段正文，并在段首标出原始行号；完整上下文以只读的 engine 快照为准。摘录用于追踪，不是独立编译单元。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | Godot 源文件 | 上游行段 |
| --- | --- | --- |
| [object.cpp](src/upstream/core/object/object.cpp.excerpt) | godot-4.7/core/object/object.cpp | 171-185, 1920-1920, 2284-2295, 2451-2492 |
| [ref_counted.cpp](src/upstream/core/object/ref_counted.cpp.excerpt) | godot-4.7/core/object/ref_counted.cpp | 74-126 |
| [ref_counted.h](src/upstream/core/object/ref_counted.h.excerpt) | godot-4.7/core/object/ref_counted.h | 199-228 |
