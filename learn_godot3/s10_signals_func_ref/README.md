# 第 10 课：信号连接与 FuncRef 回调

**目标：** 追踪 Godot 3.6 旧式 signal-to-object/method 连接、emit_signal 分派和 FuncRef 的 ID+函数名调用。

## 本课问题

Object::connect(signal,target,method) → 连接表 → emit_signal → 目标方法；funcref → FuncRef(ObjectID,function) → call_func → Object::call

## 源码调用链

源码依据：`engine/godot-3.6/`（Godot 3.6 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

~~~text
Object::connect(signal,target,method) → 连接表 → emit_signal → 目标方法；funcref → FuncRef(ObjectID,function) → call_func → Object::call
~~~
- `engine/godot-3.6/core/object.cpp:1172-1265`：本课追踪摘录。
- `engine/godot-3.6/core/object.cpp:1452-1510`：本课追踪摘录。
- `engine/godot-3.6/core/func_ref.cpp:33-101`：本课追踪摘录。
- `engine/godot-3.6/modules/gdscript/gdscript_functions.cpp:592-615`：本课追踪摘录。
- `engine/godot-3.6/modules/gdscript/gdscript_functions.cpp:1760-1766`：本课追踪摘录。

## 本课源码复刻

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-3.6` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [func_ref.cpp](src/upstream/core/func_ref.cpp) | [摘录](src/upstream/core/func_ref.cpp.excerpt) | `engine/godot-3.6/core/func_ref.cpp` | 33-101 |
| 2 | [object.cpp](src/upstream/core/object.cpp) | [摘录](src/upstream/core/object.cpp.excerpt) | `engine/godot-3.6/core/object.cpp` | 1172-1265 |
| 3 | [gdscript_functions.cpp](src/upstream/modules/gdscript/gdscript_functions.cpp) | [摘录](src/upstream/modules/gdscript/gdscript_functions.cpp.excerpt) | `engine/godot-3.6/modules/gdscript/gdscript_functions.cpp` | 592-615, 1760-1766 |

## 可运行源码复刻

课程代码 [`src/source_replay.gd`](src/source_replay.gd) 按本课 C++ 函数关系实现一个小型 GDScript 模型；入口脚本会先运行它，再执行下面的真实引擎 API 实验。阅读时把模型中的状态变化逐步映射到上方的 C++ 摘录。模型只复刻本课选出的路径，不声称等同于完整 Godot 引擎。

## 最小 Godot/GDScript 实验

连接并发射自定义 signal，再创建 FuncRef 调用该脚本方法，比较信号参数与显式参数。

实验工程文件：

- [`main.tscn`](main.tscn)
- [`project.godot`](project.godot)
- [`signal_probe.gd`](signal_probe.gd)

## 运行与预期观察

在本课目录用 Godot 3.6 启动工程。命令中的 godot 需要指向支持本课项目格式的程序；未加入 PATH 时替换为对应 app bundle 内的可执行程序路径。

~~~sh
godot --path .
~~~

**预期观察：** 先看到 signal 接收函数日志，再看到 FuncRef.call_func 计算结果；两条路径最终都会调用目标对象方法。

**动手改一处：** 将 signal 参数改为两个值，并将 FuncRef 指向另一个方法，比较连接参数转发与 `call_func()` 参数传递。

## 简化与边界

Godot 3.6 使用 connect(signal, object, method) 和 FuncRef；Godot 4 使用 Callable 风格连接。

源码引用描述本地快照中的实现；运行日志描述实际运行时行为。两类证据分别记录。

## 下一课

继续阅读 [s11_reference_ownership](../s11_reference_ownership/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
