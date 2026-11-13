# 第 10 课：Callable 与 Signal 调用链

**目标：** 追踪 Godot 4.7 的 Callable 表示、connect(Callable) 登记，以及 emit_signalp 如何调用连接目标。

## 本课要回答的问题

GDScript 方法引用 → Callable → Object::connect → signal_map → emit_signalp → Callable::callp → Object::callp/GDScript

## C++ 调用链

~~~text
GDScript 方法引用 → Callable → Object::connect → signal_map → emit_signalp → Callable::callp → Object::callp/GDScript
~~~

## C++ 源码位置

- `engine/godot-4.7/core/variant/callable.cpp:44-87`：本课追踪摘录。
- `engine/godot-4.7/core/variant/variant.h:922-940`：本课追踪摘录。
- `engine/godot-4.7/core/object/object.cpp:1179-1221`：本课追踪摘录。
- `engine/godot-4.7/core/object/object.cpp:1233-1315`：本课追踪摘录。
- `engine/godot-4.7/core/object/object.cpp:1518-1580`：本课追踪摘录。

## 本课源码复刻

课内文件保留对应上游源码行段正文，并在段首标出原始行号。摘录用于逐行追踪，不是独立编译单元。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | Godot 源码 | 上游行段 |
| --- | --- | --- |
| [variant.h](src/upstream/core/variant/variant.h.excerpt) | godot-4.7/core/variant/variant.h | 922-940 |
| [object.cpp](src/upstream/core/object/object.cpp.excerpt) | godot-4.7/core/object/object.cpp | 1179-1221, 1233-1315, 1518-1580 |
| [callable.cpp](src/upstream/core/variant/callable.cpp.excerpt) | godot-4.7/core/variant/callable.cpp | 44-87 |

## 最小 Godot/GDScript 实验

把方法引用封装为 Callable 并连接 Signal，发射整型参数；再用 call 与 bind 构造部分参数函数。

实验工程文件：

- [`main.tscn`](main.tscn)
- [`project.godot`](project.godot)
- [`signal_probe.gd`](signal_probe.gd)

## 运行与观察

在本课目录用 Godot 4.7 启动工程。命令中的 godot 需要指向支持本课项目格式的程序；未加入 PATH 时替换为对应 app bundle 内的可执行程序路径。

~~~sh
godot --path .
~~~

**预期观察：** 信号发射同步调用 GDScript 方法；Callable 直接调用和 bind 后调用输出计算结果，连接状态可查询。

**动手改一处：** 把 `bind(5)` 改成绑定另一个整数，并改变 signal 发射值，分别预测连接回调和部分应用 Callable 的结果。

## 简化与边界

展示普通同步连接及 Callable.bind。延迟、一次性、线程组、RPC 和自定义 Callable 后端以完整源码为准。

源码引用描述本地快照中的实现；运行日志描述实际运行时行为。两类证据分别记录。
