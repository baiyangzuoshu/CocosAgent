# 第 7 课：`ObjectID` 与 `RefCounted` 生命周期

**目标：** 追踪 Godot 4.7 的 `ObjectDB` ID、预删除和引用计数路径，比较普通 `Object` 与 `RefCounted` 的释放方式。

## 本课增量

用 ObjectDB 实例 ID 表对比普通 Object 显式 free 与引用计数对象最后一次 unref。

## 本课问题

`ObjectID` 如何区分复用的对象槽？`RefCounted` 的最后一次 unreference 如何触发析构？`NOTIFICATION_PREDELETE` 与 ID 移除处于什么阶段？

## 源码调用链

源码依据：`engine/godot-4.7/`（Godot 4.7 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-4.7/` 快照根目录：

- `core/object/object.cpp:2284-2295`：`Object` 构造时设置引用标记并向 ObjectDB 登记实例 ID。
- `core/object/object.cpp:2451-2492`、`2495-2518`：ObjectDB 使用 slot、validator 和 refcount 标记编码 ID，并在移除实例时回收槽位。
- `core/object/object.cpp:171-185`、`1849`：删除前发送 `NOTIFICATION_PREDELETE`；`get_instance_id()` 公开给脚本。
- `core/object/ref_counted.cpp:74-126`：`RefCounted::reference/unreference()` 更新原子引用数，并判定是否达到删除条件。
- `core/object/ref_counted.h:199-228`：`Ref<T>` 在最后一次 unreference 后 `memdelete` 对象。
- `core/object/object.cpp:1920`：Object 类把脚本 `free()` 声明为虚方法，供普通 Object 显式释放。

## 本课源码复刻

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-4.7` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [object.cpp](src/upstream/core/object/object.cpp) | [摘录](src/upstream/core/object/object.cpp.excerpt) | `engine/godot-4.7/core/object/object.cpp` | 171-185, 1920-1920, 2284-2295 |
| 2 | [ref_counted.cpp](src/upstream/core/object/ref_counted.cpp) | [摘录](src/upstream/core/object/ref_counted.cpp.excerpt) | `engine/godot-4.7/core/object/ref_counted.cpp` | 74-126 |
| 3 | [ref_counted.h](src/upstream/core/object/ref_counted.h) | [摘录](src/upstream/core/object/ref_counted.h.excerpt) | `engine/godot-4.7/core/object/ref_counted.h` | 199-228 |

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
