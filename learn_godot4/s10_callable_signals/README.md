# 第 10 课：Callable 与 Signal 调用链

**目标：** 追踪 Godot 4.7 的 Callable 表示、connect(Callable) 登记，以及 emit_signalp 如何调用连接目标。

## 本课增量

复刻 Callable 的对象/方法/绑定参数、连接重复检查、Signal 发射和 callp 参数合并。

**本课要回答：** GDScript 方法引用 → Callable → Object::connect → signal_map → emit_signalp → Callable::callp → Object::callp/GDScript

## C++ 源码追踪

源码依据：`engine/godot-4.7/`（Godot 4.7 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

~~~text
GDScript 方法引用 → Callable → Object::connect → signal_map → emit_signalp → Callable::callp → Object::callp/GDScript
~~~
- `engine/godot-4.7/core/variant/callable.cpp:44-87`：本课追踪摘录。
- `engine/godot-4.7/core/variant/variant.h:922-940`：本课追踪摘录。
- `engine/godot-4.7/core/object/object.cpp:1179-1221`：本课追踪摘录。
- `engine/godot-4.7/core/object/object.cpp:1233-1315`：本课追踪摘录。
- `engine/godot-4.7/core/object/object.cpp:1518-1580`：本课追踪摘录。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [object.cpp](src/upstream/core/object/object.cpp) | [1179-1221 ; 1233-1315 ; 1518-1580](src/upstream/core/object/object.cpp.excerpt) | engine/godot-4.7/core/object/object.cpp |
| 2 | [callable.cpp](src/upstream/core/variant/callable.cpp) | [44-87](src/upstream/core/variant/callable.cpp.excerpt) | engine/godot-4.7/core/variant/callable.cpp |
| 3 | [variant.h](src/upstream/core/variant/variant.h) | [922-940](src/upstream/core/variant/variant.h.excerpt) | engine/godot-4.7/core/variant/variant.h |

## GDScript 源码复刻

S10 Godot 4.7: SignalData stores Callable; emit snapshots slots before callp.

source_replay.gd 按本课指定快照复刻控制流与状态传递，模型中的状态字段、函数入口和 API 名称对应本代 C++ 路径。根目录实验脚本先运行模型，再调用对应版本的 Godot API。

| GDScript 函数 | 复刻步骤 |
| --- | --- |
| _make_callable() | 登记回调并按目标 ID、方法和参数调用目标 |
| _connect() | 登记回调并按目标 ID、方法和参数调用目标 |
| _same_callable() | 登记回调并按目标 ID、方法和参数调用目标 |
| _emit() | 登记回调并按目标 ID、方法和参数调用目标 |
| _callp() | 登记回调并按目标 ID、方法和参数调用目标 |

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

## 下一课

继续阅读 [s11_refcounted_resource_lifetime](../s11_refcounted_resource_lifetime/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
