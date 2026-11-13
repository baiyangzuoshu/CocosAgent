# 第 10 课：Variant 转换与运算分派

**目标：** 沿 GDScript 运算 opcode、Variant::evaluate、Variant::construct 和类型转换 builtin 追踪动态值。

## 本课要回答的问题

GDScript opcode → Variant::evaluate；convert → Variant::construct/can_convert；var2str/str2var → Variant writer/parser

## C++ 调用链

~~~text
GDScript opcode → Variant::evaluate；convert → Variant::construct/can_convert；var2str/str2var → Variant writer/parser
~~~

## C++ 源码位置

- `engine/godot-2.1/modules/gdscript/gd_function.cpp:312-340`：本课追踪摘录。
- `engine/godot-2.1/core/variant_op.cpp:238-300`：本课追踪摘录。
- `engine/godot-2.1/core/variant.cpp:198-270`：本课追踪摘录。
- `engine/godot-2.1/core/variant_call.cpp:1017-1110`：本课追踪摘录。
- `engine/godot-2.1/modules/gdscript/gd_functions.cpp:507-530`：本课追踪摘录。
- `engine/godot-2.1/modules/gdscript/gd_functions.cpp:621-635`：本课追踪摘录。

## 本课源码复刻

课内文件保留对应上游源码行段正文，并在段首标出原始行号。摘录用于逐行追踪，不是独立编译单元。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | Godot 源码 | 上游行段 |
| --- | --- | --- |
| [variant.cpp](src/upstream/core/variant.cpp.excerpt) | godot-2.1/core/variant.cpp | 198-270 |
| [variant_call.cpp](src/upstream/core/variant_call.cpp.excerpt) | godot-2.1/core/variant_call.cpp | 1017-1110 |
| [variant_op.cpp](src/upstream/core/variant_op.cpp.excerpt) | godot-2.1/core/variant_op.cpp | 238-300 |
| [gd_function.cpp](src/upstream/modules/gdscript/gd_function.cpp.excerpt) | godot-2.1/modules/gdscript/gd_function.cpp | 312-340 |
| [gd_functions.cpp](src/upstream/modules/gdscript/gd_functions.cpp.excerpt) | godot-2.1/modules/gdscript/gd_functions.cpp | 507-530, 621-635 |

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
