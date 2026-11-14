# 第 10 课：信号连接与 FuncRef 回调

**目标：** 追踪 Godot 3.6 旧式 signal-to-object/method 连接、emit_signal 分派和 FuncRef 的 ID+函数名调用。

## 本课增量

复刻 signal connection 的 ObjectID/方法名登记与 Object::call；另用 FuncRef 的 ID+函数名路径回调。

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

## GDScript 源码复刻与 C++ 对照

模型将 signal 连接保存为 ObjectID+方法名，拒绝重复连接，发射时通过对象表解析目标；FuncRef 也按 ID 和函数名调用。

src/upstream/ 保存本课引用的完整上游文件副本和带原始行号的摘录；src/source_replay.gd 执行表中的教学模型。先观察模型如何改变状态或走分支，再回到对应 C++ 函数核对。模型不替代 C++，也不代表引擎运行时本身。

| C++ 追踪阶段 | 模型函数 | 运行时要观察什么 |
| --- | --- | --- |
| Object::connect / signal connection list | _connect_signal() | 写入 ObjectID+方法名并拒绝重复连接 |
| Object::emit_signal → Object::call | _emit_signal() → _call_object() | 发射值到达 Receiver 后改变 score 状态 |
| FuncRef::call_func | _call_func() | 从保存的 ObjectID 和函数名解析目标并拿到返回值 |

独立项目入口先调用 source_replay.gd，再执行真实 Godot API 实验。实验脚本：signal_probe.gd。模型输出是确定性的教学数据；只有实际用对应版本 Godot 运行后，才能记录为引擎实验验证。
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
