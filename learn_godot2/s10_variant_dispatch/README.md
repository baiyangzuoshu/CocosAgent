# 第 10 课：Variant 转换与运算分派

**目标：** 沿 GDScript 运算 opcode、Variant::evaluate、Variant::construct 和类型转换 builtin 追踪动态值。

## 本课增量

复刻旧版 GDScript 运算进入 Variant::evaluate 的类型分支，并展示构造转换、除零错误和文本输出。

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

## GDScript 源码复刻与 C++ 对照

模型按 Variant 类型标签执行 ADD/除零错误分派、类型构造和文本化，对照旧版 GDScript opcode 到 Variant::evaluate。

src/upstream/ 保存本课引用的完整上游文件副本和带原始行号的摘录；src/source_replay.gd 执行表中的教学模型。先观察模型如何改变状态或走分支，再回到对应 C++ 函数核对。模型不替代 C++，也不代表引擎运行时本身。

| C++ 追踪阶段 | 模型函数 | 运行时要观察什么 |
| --- | --- | --- |
| Variant::evaluate | _variant() → _evaluate() | 按操作符和 INT/REAL/STRING 类型标签选择分支 |
| Variant::construct / convert builtin | _construct() | 执行 STRING 构造并报告非法运算/除零 |
| var2str conversion path | _variant_to_string() | 输出运算后的 Variant 值 |

独立项目入口先调用 source_replay.gd，再执行真实 Godot API 实验。实验脚本：variant_probe.gd。模型输出是确定性的教学数据；只有实际用对应版本 Godot 运行后，才能记录为引擎实验验证。
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
