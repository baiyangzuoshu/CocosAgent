# 第 10 课：Variant 转换与运算分派

**目标：** 沿 GDScript 运算 opcode、Variant::evaluate、Variant::construct 和类型转换 builtin 追踪动态值。

## 本课问题

GDScript opcode → Variant::evaluate；convert → Variant::construct/can_convert；var2str/str2var → Variant writer/parser

## 源码调用链

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

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-2.1` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [variant.cpp](src/upstream/core/variant.cpp) | [摘录](src/upstream/core/variant.cpp.excerpt) | `engine/godot-2.1/core/variant.cpp` | 198-270 |
| 2 | [variant_call.cpp](src/upstream/core/variant_call.cpp) | [摘录](src/upstream/core/variant_call.cpp.excerpt) | `engine/godot-2.1/core/variant_call.cpp` | 1017-1110 |
| 3 | [variant_op.cpp](src/upstream/core/variant_op.cpp) | [摘录](src/upstream/core/variant_op.cpp.excerpt) | `engine/godot-2.1/core/variant_op.cpp` | 238-300 |
| 4 | [gd_function.cpp](src/upstream/modules/gdscript/gd_function.cpp) | [摘录](src/upstream/modules/gdscript/gd_function.cpp.excerpt) | `engine/godot-2.1/modules/gdscript/gd_function.cpp` | 312-340 |
| 5 | [gd_functions.cpp](src/upstream/modules/gdscript/gd_functions.cpp) | [摘录](src/upstream/modules/gdscript/gd_functions.cpp.excerpt) | `engine/godot-2.1/modules/gdscript/gd_functions.cpp` | 507-530, 621-635 |

## 可运行源码复刻

课程代码 [`src/source_replay.gd`](src/source_replay.gd) 按本课 C++ 函数关系实现一个小型 GDScript 模型；入口脚本会先运行它，再执行下面的真实引擎 API 实验。阅读时把模型中的状态变化逐步映射到上方的 C++ 摘录。模型只复刻本课选出的路径，不声称等同于完整 Godot 引擎。

## 最小 Godot/GDScript 实验

用函数参数触发运行时加法，比较类型码与转换结果，再往返序列化包含 Vector2 的 Dictionary。

实验工程文件：

- [`engine.cfg`](engine.cfg)
- [`main.tscn`](main.tscn)
- [`variant_probe.gd`](variant_probe.gd)

## 运行与预期观察

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
