# 第 10 课：信号连接与 FuncRef 回调

**目标：** 追踪 Godot 3.6 旧式 signal-to-object/method 连接、emit_signal 分派和 FuncRef 的 ID+函数名调用。

## 本课增量

复刻 signal connection 的 ObjectID/方法名登记与 Object::call；另用 FuncRef 的 ID+函数名路径回调。

**本课要回答：** Object::connect(signal,target,method) → 连接表 → emit_signal → 目标方法；funcref → FuncRef(ObjectID,function) → call_func → Object::call

## C++ 源码追踪

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

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [func_ref.cpp](src/upstream/core/func_ref.cpp) | [33-101](src/upstream/core/func_ref.cpp.excerpt) | engine/godot-3.6/core/func_ref.cpp |
| 2 | [object.cpp](src/upstream/core/object.cpp) | [1172-1265 ; 1452-1510](src/upstream/core/object.cpp.excerpt) | engine/godot-3.6/core/object.cpp |
| 3 | [gdscript_functions.cpp](src/upstream/modules/gdscript/gdscript_functions.cpp) | [592-615 ; 1760-1766](src/upstream/modules/gdscript/gdscript_functions.cpp.excerpt) | engine/godot-3.6/modules/gdscript/gdscript_functions.cpp |

## GDScript 源码复刻

S10 Godot 3.6: legacy object/method connection and FuncRef(ObjectID, function).

source_replay.gd 按本课指定快照复刻控制流与状态传递，模型中的状态字段、函数入口和 API 名称对应本代 C++ 路径。根目录实验脚本先运行模型，再调用对应版本的 Godot API。

| GDScript 函数 | 复刻步骤 |
| --- | --- |
| _connect() | 登记回调并按目标 ID、方法和参数调用目标 |
| _emit() | 登记回调并按目标 ID、方法和参数调用目标 |
| _call_func() | 登记回调并按目标 ID、方法和参数调用目标 |
| _call_object() | 登记回调并按目标 ID、方法和参数调用目标 |

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

## 下一课

继续阅读 [s11_reference_ownership](../s11_reference_ownership/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
