# 第 7 课：`Object` ID、显式释放与 `Reference` 生命周期

**目标：** 追踪 Godot 1.1 对象如何注册到 `ObjectDB` 并取得实例 ID，以及 `Reference` 如何用引用计数决定何时删除。

## 本课问题

普通 `Object` 和 `Reference` 的释放责任有什么不同？对象 ID 在何时登记、何时从 `ObjectDB` 移除？最后一个引用释放时会发生什么？

## C++ 源码追踪

以下路径相对于 `engine/godot-1.1/` 快照根目录：

- `core/object.cpp:1608-1614`：`Object` 构造时由 `ObjectDB::add_instance()` 登记对象并分配 `get_instance_ID()`。
- `core/object.cpp:1632-1673`、`1692-1717`：析构时从 ObjectDB 移除 ID；ObjectDB 保存 ID 到对象指针的映射并提供查询。
- `core/object.cpp:256-260`：实际删除前调用 `NOTIFICATION_PREDELETE`；`1443`、`1526`、`1530` 将 ID、脚本 `free()` 和 `_notification()` 暴露给脚本类型系统。
- `core/reference.cpp:66-80`：`Reference` 增减 `SafeRefCount`。
- `core/reference.h:285-305`：C++ `Ref<T>` 在释放持有项时调用 `unreference()`；计数归零后才 `memdelete` 对象。

## 最小实验

- `engine.cfg` 指向本目录的 Godot 1.1 XML 场景 `main.xml`。
- `manual_object.gd` 继承 `Object`，打印实例 ID 和 `NOTIFICATION_PREDELETE`。
- `reference_probe.gd` 继承 `Reference`；`lifetime_probe.gd` 先显式调用普通对象的 `free()`，再把一个 Reference 存入两个变量并逐个清空。
- 在本目录运行：

```sh
godot -path .
```

预期普通对象在调用 `free()` 时先报告 PREDELETE；Reference 在清空第一个变量后仍存活，清空第二个变量后报告 PREDELETE。ID 只用于标识实例，不是对象所有权。

## 简化与边界

实验不查询 ObjectDB 内部映射，也不讨论循环引用、跨线程引用或 Node 的场景树所有权。Godot 1.1 使用 `get_instance_ID()`、`Reference`、`ObjectTypeDB` 和 `SafeRefCount`；本课尚未运行。
