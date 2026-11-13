# 第 10 课：信号连接与 FuncRef 回调

**目标：** 追踪 Godot 3.6 旧式 signal-to-object/method 连接、emit_signal 分派和 FuncRef 的 ID+函数名调用。

## 本课要回答的问题

Object::connect(signal,target,method) → 连接表 → emit_signal → 目标方法；funcref → FuncRef(ObjectID,function) → call_func → Object::call

## C++ 调用链

~~~text
Object::connect(signal,target,method) → 连接表 → emit_signal → 目标方法；funcref → FuncRef(ObjectID,function) → call_func → Object::call
~~~

## C++ 源码位置

- `engine/godot-3.6/core/object.cpp:1172-1265`：本课追踪摘录。
- `engine/godot-3.6/core/object.cpp:1452-1510`：本课追踪摘录。
- `engine/godot-3.6/core/func_ref.cpp:33-101`：本课追踪摘录。
- `engine/godot-3.6/modules/gdscript/gdscript_functions.cpp:592-615`：本课追踪摘录。
- `engine/godot-3.6/modules/gdscript/gdscript_functions.cpp:1760-1766`：本课追踪摘录。

## 本课源码复刻

课内文件保留对应上游源码行段正文，并在段首标出原始行号。摘录用于逐行追踪，不是独立编译单元。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | Godot 源码 | 上游行段 |
| --- | --- | --- |
| [func_ref.cpp](src/upstream/core/func_ref.cpp.excerpt) | godot-3.6/core/func_ref.cpp | 33-101 |
| [object.cpp](src/upstream/core/object.cpp.excerpt) | godot-3.6/core/object.cpp | 1172-1265, 1452-1510 |
| [gdscript_functions.cpp](src/upstream/modules/gdscript/gdscript_functions.cpp.excerpt) | godot-3.6/modules/gdscript/gdscript_functions.cpp | 592-615, 1760-1766 |

## 最小 Godot/GDScript 实验

连接并发射自定义 signal，再创建 FuncRef 调用该脚本方法，比较信号参数与显式参数。

实验工程文件：

- [`main.tscn`](main.tscn)
- [`project.godot`](project.godot)
- [`signal_probe.gd`](signal_probe.gd)

## 运行与观察

在本课目录用 Godot 3.6 启动工程。命令中的 godot 需要指向支持本课项目格式的程序；未加入 PATH 时替换为对应 app bundle 内的可执行程序路径。

~~~sh
godot --path .
~~~

**预期观察：** 先看到 signal 接收函数日志，再看到 FuncRef.call_func 计算结果；两条路径最终都会调用目标对象方法。

**动手改一处：** 将 signal 参数改为两个值，并将 FuncRef 指向另一个方法，比较连接参数转发与 `call_func()` 参数传递。

## 简化与边界

Godot 3.6 使用 connect(signal, object, method) 和 FuncRef；Godot 4 使用 Callable 风格连接。

源码引用描述本地快照中的实现；运行日志描述实际运行时行为。两类证据分别记录。
