# 第 7 课：`ObjectDB`、实例 ID 与 `Reference` 销毁

**目标：** 追踪 Godot 3.6 `Object` 的实例登记与预删除通知，并从 `Reference` 引用计数理解何时真正释放对象。

## 本课增量

用 ObjectDB 实例 ID 表对比普通 Object 显式 free 与引用计数对象最后一次 unref。

## 本课问题

对象 ID 由谁生成和移除？`NOTIFICATION_PREDELETE` 与 C++ 析构是什么顺序？当脚本变量共享一个 `Reference` 时，谁决定删除时机？

## 源码调用链

源码依据：`engine/godot-3.6/`（Godot 3.6 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-3.6/` 快照根目录：

- `core/object.cpp:1931-1952`：构造时向 `ObjectDB::add_instance()` 登记并分配 `ObjectID`；`core/object.h:604` 暴露 `get_instance_id()`。
- `core/object.cpp:388-395`、`1954-2005`、`2015-2047`：预删除阶段发送 `NOTIFICATION_PREDELETE`，随后析构并从 ObjectDB 移除 ID；ObjectDB 保存和查询实例映射。
- `core/reference.cpp:57-96`：`Reference::reference/unreference()` 更新引用数并同步脚本引用状态。
- `core/reference.h:252-273`：`Ref<T>` 在最后引用释放时调用 `memdelete`。
- `core/object.cpp:1747`：Object 类型注册了脚本可调用的虚拟 `free()` 方法。

## 本课源码复刻

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-3.6` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [object.cpp](src/upstream/core/object.cpp) | [摘录](src/upstream/core/object.cpp.excerpt) | `engine/godot-3.6/core/object.cpp` | 388-395, 1747-1747, 1931-1952 |
| 2 | [object.h](src/upstream/core/object.h) | [摘录](src/upstream/core/object.h.excerpt) | `engine/godot-3.6/core/object.h` | 604-604 |
| 3 | [reference.cpp](src/upstream/core/reference.cpp) | [摘录](src/upstream/core/reference.cpp.excerpt) | `engine/godot-3.6/core/reference.cpp` | 57-96 |
| 4 | [reference.h](src/upstream/core/reference.h) | [摘录](src/upstream/core/reference.h.excerpt) | `engine/godot-3.6/core/reference.h` | 252-273 |

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

- `project.godot` 使用 Godot 3.6 配置，主场景为 `main.tscn`。
- `manual_object.gd` 继承 `Object` 并显式调用 `free()`；`reference_probe.gd` 继承 `Reference`，主脚本用两个变量持有它并逐个清空。
- 在本目录运行：

```sh
godot --path .
```

观察两个对象各自打印的 ID 和 PREDELETE。普通 Object 在显式 `free()` 时释放；Reference 在最后一个变量清空时释放。实例 ID 不会延长对象生命。

## 简化与边界

不演示 `WeakRef`、引用循环、脚本实例绑定计数或多线程析构。Godot 3.6 使用 `Reference`、`ObjectID`、`ClassDB` 与 GDScript `free()` 虚方法；本课尚未运行。

## 下一课

继续阅读 [s08_classdb_registration](../s08_classdb_registration/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
