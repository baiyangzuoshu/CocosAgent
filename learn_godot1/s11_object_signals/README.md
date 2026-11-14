# 第 11 课：Object 信号连接、绑定与跨对象发射

**目标：** 沿旧式 Object::connect(signal, target, method) 与 emit_signal 追踪连接表和目标方法调用，并用 GDScript 同步发射参数。

## 本课问题

脚本 connect 的目标对象和方法名怎样保存？emit_signal 遇到多个连接时如何构造参数并调用接收方？

## C++ 源码追踪

以下行号相对于仓库本地 `engine/godot-1.1/` 快照。
- `engine/godot-1.1/core/object.cpp:1099-1215, 1314-1349`：摘录包含本课的关键函数实现。

调用链：`Object::connect → signal_connections → Object::emit_signal → target Object::call → GDScript 方法`

## 源码阅读顺序

1. `Object::connect` 检查信号名和接收方法，把目标对象、方法名、bind 参数及连接标志写入对象连接表；同一个信号可以有多条连接。
2. `Object::emit_signal` 取出该信号的连接项，将发射参数与每项 bind 参数组合，再同步调用目标对象的方法。实验用两个参数分开观察“发射参数”和“连接时绑定参数”。

连接表保存信号名、目标对象、目标方法及可选绑定参数。发射时引擎取出该信号的连接项，组合发射参数和绑定参数，再调用目标对象的方法。此处追踪 Godot 1/2 的 Object 连接模型，不把 Godot 4 的 Callable 连接形式套入。

## 最小 Godot/GDScript 实验

主节点创建一个带接收脚本的子节点，以旧式 connect 连接 course_signal 并绑定参数 99；随后发射整数 7，观察接收方法拿到发射值和绑定值。

实验文件：

- [`engine.cfg`](engine.cfg)
- [`main.xml`](main.xml)
- [`receiver_probe.gd`](receiver_probe.gd)
- [`signal_probe.gd`](signal_probe.gd)

## 运行与观察

在本课目录用匹配本代的 Godot 程序运行：

```sh
godot -path .
```

**预期观察：** 预期先打印发射标记，再看到接收方法收到 7 和连接时绑定的 99。此输出验证脚本层同步分派；Object 连接表的实现结论来自本地 C++ 快照。

**动手改一处：** 新增一个接收方法并重复 connect，先根据 connect 的重复连接检查预测会不会重复输出，再运行观察。

## 简化与边界

实验覆盖一个发射对象、一个接收对象、同步分派和一个绑定参数；不覆盖弱引用、一次性连接和跨线程信号。

未在本次静态检查中启动该项目；源码事实与预期输出分开记录。

## 本课 C++ 源码摘录

课内 `src/upstream/` 复制本课对应的上游行段并标出原始行号，供逐段追踪；完整源码上下文仍以只读 engine 快照为准。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | 上游文件 | 行号 |
| --- | --- | --- |
| [object.cpp](src/upstream/core/object.cpp.excerpt) | `engine/godot-1.1/core/object.cpp` | 1099-1215, 1314-1349 |

## 下一课

[第 12 课：GDScript tokenizer、parser 与脚本验证](../s12_gdscript_parse/README.md)
