# 第 10 课：Variant 转换与运算分派

**目标：** 沿 GDScript 运算 opcode、Variant::evaluate、Variant::construct 和类型转换 builtin 追踪动态值。

## 本课增量

复刻旧版 GDScript 运算进入 Variant::evaluate 的类型分支，并展示构造转换、除零错误和文本输出。

**本课要回答：** GDScript opcode → Variant::evaluate；convert → Variant::construct/can_convert；var2str/str2var → Variant writer/parser

## C++ 源码追踪

源码依据：`engine/godot-2.1/`（Godot 2.1 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

~~~text
GDScript opcode → Variant::evaluate；convert → Variant::construct/can_convert；var2str/str2var → Variant writer/parser
~~~
- `engine/godot-2.1/modules/gdscript/gd_function.cpp:312-340`：本课追踪摘录。
- `engine/godot-2.1/core/variant_op.cpp:238-300`：本课追踪摘录。
- `engine/godot-2.1/core/variant.cpp:198-270`：本课追踪摘录。
- `engine/godot-2.1/core/variant_call.cpp:1017-1110`：本课追踪摘录。
- `engine/godot-2.1/modules/gdscript/gd_functions.cpp:507-530`：本课追踪摘录。
- `engine/godot-2.1/modules/gdscript/gd_functions.cpp:621-635`：本课追踪摘录。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [variant.cpp](src/upstream/core/variant.cpp) | [198-270](src/upstream/core/variant.cpp.excerpt) | engine/godot-2.1/core/variant.cpp |
| 2 | [variant_call.cpp](src/upstream/core/variant_call.cpp) | [1017-1110](src/upstream/core/variant_call.cpp.excerpt) | engine/godot-2.1/core/variant_call.cpp |
| 3 | [variant_op.cpp](src/upstream/core/variant_op.cpp) | [238-300](src/upstream/core/variant_op.cpp.excerpt) | engine/godot-2.1/core/variant_op.cpp |
| 4 | [gd_function.cpp](src/upstream/modules/gdscript/gd_function.cpp) | [312-340](src/upstream/modules/gdscript/gd_function.cpp.excerpt) | engine/godot-2.1/modules/gdscript/gd_function.cpp |
| 5 | [gd_functions.cpp](src/upstream/modules/gdscript/gd_functions.cpp) | [507-530 ; 621-635](src/upstream/modules/gdscript/gd_functions.cpp.excerpt) | engine/godot-2.1/modules/gdscript/gd_functions.cpp |

## GDScript 源码复刻

S10 Godot 2.1: GDScript operator bytecode selects a Variant operation implementation.

source_replay.gd 按本课指定快照复刻控制流与状态传递，模型中的状态字段、函数入口和 API 名称对应本代 C++ 路径。根目录实验脚本先运行模型，再调用对应版本的 Godot API。

| GDScript 函数 | 复刻步骤 |
| --- | --- |
| _evaluate() | 维护 Variant 类型标签并执行构造/转换/序列化分支 |
| _construct() | 维护 Variant 类型标签并执行构造/转换/序列化分支 |

## 最小 Godot/GDScript 实验

用函数参数触发运行时加法，比较类型码与转换结果，再往返序列化包含 Vector2 的 Dictionary。

实验工程文件：

- [`engine.cfg`](engine.cfg)
- [`main.tscn`](main.tscn)
- [`variant_probe.gd`](variant_probe.gd)

## 运行与观察

在本课目录用 Godot 2.1 启动工程。命令中的 godot 需要指向支持本课项目格式的程序；未加入 PATH 时替换为对应 app bundle 内的可执行程序路径。

~~~sh
godot -path .
~~~

**预期观察：** 日志显示运行时加法、typeof 类型码、字符串转整数及 Dictionary 序列化往返结果。

**动手改一处：** 改变 `left`、`right` 的 Variant 类型，先依据本代 `Variant::evaluate` 预测加法结果，再运行观察。

## 简化与边界

Godot 2.1 的 Variant 类型与构造器列表以本快照为准；不外推 Godot 3/4 的类型枚举和错误语义。

源码引用描述本地快照中的实现；运行日志描述实际运行时行为。两类证据分别记录。

## 下一课

继续阅读 [s11_signals_notifications](../s11_signals_notifications/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
