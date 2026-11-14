# 第 7 课：`ObjectDB`、实例 ID 与 `Reference` 销毁

**目标：** 追踪 Godot 3.6 `Object` 的实例登记与预删除通知，并从 `Reference` 引用计数理解何时真正释放对象。

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

## 可运行源码复刻

课程代码 [`src/source_replay.gd`](src/source_replay.gd) 按本课 C++ 函数关系实现一个小型 GDScript 模型；入口脚本会先运行它，再执行下面的真实引擎 API 实验。阅读时把模型中的状态变化逐步映射到上方的 C++ 摘录。模型只复刻本课选出的路径，不声称等同于完整 Godot 引擎。

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
