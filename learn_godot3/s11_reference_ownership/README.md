# 第 11 课：Reference 引用计数与 Resource 所有权

**目标：** 追踪 Reference 的引用计数归零路径，并把 Resource 作为引用持有型对象看待。

## 本课问题

脚本变量复制后，哪一次 unreference 会触发 Reference 的销毁？Resource 的路径设置与对象生命期是同一件事吗？

## C++ 源码追踪

以下行号相对于仓库本地 `engine/godot-3.6/` 快照。
- `engine/godot-3.6/core/reference.cpp:57-75, 77-97`：摘录包含本课的关键函数实现。
- `engine/godot-3.6/core/resource.cpp:49-92`：摘录包含本课的关键函数实现。

调用链：`Reference constructor/refcount init → reference/unreference → refcount zero → PREDELETE → delete; Resource::set_path 只维护资源身份路径`

## 源码阅读顺序

1. `Reference::reference` 与 `Reference::unreference` 是强引用计数入口；沿 `Reference::unreference` 的归零分支查看预删除通知与销毁发生的次序。
2. `Resource::set_path` 更新资源路径身份和缓存关系。把它与引用计数分开读：路径/缓存管理本身不能代替一个活跃脚本引用。

Reference 的 reference/unreference 操作维护原子计数；最后一次释放进入预删除通知和对象析构。Resource 使用引用持有模型，资源路径管理另外通过 Resource 的路径/缓存逻辑处理，不能把“路径存在”当成“对象仍被引用”。

## 最小 Godot/GDScript 实验

创建带 PREDELETE 日志的自定义 Reference/RefCounted，复制脚本变量，先清空一个引用，再清空最后一个引用，观察最后阶段的通知。

实验文件：

- [`project.godot`](project.godot)
- [`main.tscn`](main.tscn)
- [`ownership_probe.gd`](ownership_probe.gd)
- [`tracked_reference.gd`](tracked_reference.gd)

## 运行与观察

在本课目录用匹配本代的 Godot 程序运行：

```sh
godot --path .
```

**预期观察：** 预期第一个变量清空后对象仍可访问；最后一个脚本引用释放后出现 PREDELETE。具体通知时点以匹配版本的运行日志确认。

**动手改一处：** 增加第三个别名变量，先清除两个，再清除最后一个，沿 reference/unreference 判断销毁发生在哪一步。

## 简化与边界

只观察强引用，不模拟资源缓存、弱引用、线程安全竞态或循环引用；版本名分别为 Reference 与 RefCounted。

未在本次静态检查中启动该项目；源码事实与预期输出分开记录。

## 本课 C++ 源码摘录

课内 `src/upstream/` 复制本课对应的上游行段并标出原始行号，供逐段追踪；完整源码上下文仍以只读 engine 快照为准。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | 上游文件 | 行号 |
| --- | --- | --- |
| [reference.cpp](src/upstream/core/reference.cpp.excerpt) | `engine/godot-3.6/core/reference.cpp` | 57-75, 77-97 |
| [resource.cpp](src/upstream/core/resource.cpp.excerpt) | `engine/godot-3.6/core/resource.cpp` | 49-92 |

## 下一课

[第 12 课：GDScript tokenizer、parser 与编译](../s12_gdscript_parse_compile/README.md)
