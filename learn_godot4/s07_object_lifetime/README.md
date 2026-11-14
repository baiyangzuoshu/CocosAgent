# 第 7 课：`ObjectID` 与 `RefCounted` 生命周期

**目标：** 追踪 Godot 4.7 的 `ObjectDB` ID、预删除和引用计数路径，比较普通 `Object` 与 `RefCounted` 的释放方式。

## 本课增量

用 ObjectDB 实例 ID 表对比普通 Object 显式 free 与引用计数对象最后一次 unref。

**本课要回答：** `ObjectID` 如何区分复用的对象槽？`RefCounted` 的最后一次 unreference 如何触发析构？`NOTIFICATION_PREDELETE` 与 ID 移除处于什么阶段？

## C++ 源码追踪

源码依据：`engine/godot-4.7/`（Godot 4.7 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-4.7/` 快照根目录：

- `core/object/object.cpp:2284-2295`：`Object` 构造时设置引用标记并向 ObjectDB 登记实例 ID。
- `core/object/object.cpp:2451-2492`、`2495-2518`：ObjectDB 使用 slot、validator 和 refcount 标记编码 ID，并在移除实例时回收槽位。
- `core/object/object.cpp:171-185`、`1849`：删除前发送 `NOTIFICATION_PREDELETE`；`get_instance_id()` 公开给脚本。
- `core/object/ref_counted.cpp:74-126`：`RefCounted::reference/unreference()` 更新原子引用数，并判定是否达到删除条件。
- `core/object/ref_counted.h:199-228`：`Ref<T>` 在最后一次 unreference 后 `memdelete` 对象。
- `core/object/object.cpp:1920`：Object 类把脚本 `free()` 声明为虚方法，供普通 Object 显式释放。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [object.cpp](src/upstream/core/object/object.cpp) | [171-185 ; 1920-1920 ; 2284-2295 ; 2451-2492](src/upstream/core/object/object.cpp.excerpt) | engine/godot-4.7/core/object/object.cpp |
| 2 | [ref_counted.cpp](src/upstream/core/object/ref_counted.cpp) | [74-126](src/upstream/core/object/ref_counted.cpp.excerpt) | engine/godot-4.7/core/object/ref_counted.cpp |
| 3 | [ref_counted.h](src/upstream/core/object/ref_counted.h) | [199-228](src/upstream/core/object/ref_counted.h.excerpt) | engine/godot-4.7/core/object/ref_counted.h |

## GDScript 源码复刻

S07 Godot 4.7: ObjectID slots/validators track objects; RefCounted controls ownership.

source_replay.gd 按本课指定快照复刻控制流与状态传递，模型中的状态字段、函数入口和 API 名称对应本代 C++ 路径。根目录实验脚本先运行模型，再调用对应版本的 Godot API。

| GDScript 函数 | 复刻步骤 |
| --- | --- |
| _allocate() | 更新本课状态并向后续步骤传递结果 |
| _resolve() | 按实例 ID/ObjectID 查询对象数据库 |
| _free_object() | 移除 ObjectDB 项或更新引用计数直到销毁 |
| _ref() | 移除 ObjectDB 项或更新引用计数直到销毁 |
| _unref() | 移除 ObjectDB 项或更新引用计数直到销毁 |

## 最小 Godot/GDScript 实验

- `project.godot` 指定 `main.tscn`。
- `manual_object.gd` 继承 `Object` 并显式 `free()`；`reference_probe.gd` 继承 `RefCounted`，由两个脚本变量共享后逐个清空。
- 在本目录运行：

```sh
godot --path .
```

预期先看到普通 Object 的 PREDELETE，再看到 RefCounted 的 ID。清空第一个变量时 RefCounted 继续存活；清空最后一个变量时它才报告 PREDELETE。slot/validator 的编码细节由 C++ 源码确认。

## 简化与边界

不直接操作 `ObjectID` 位域，不演示 `WeakRef`、引用循环或多线程销毁。Godot 4.7 将 `Reference` 更名为 `RefCounted`，并使用带 validator 的 ObjectDB 槽位；本课未运行。

## 下一课

继续阅读 [s08_classdb_registration](../s08_classdb_registration/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
