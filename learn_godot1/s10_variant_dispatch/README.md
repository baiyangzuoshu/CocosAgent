# 第 10 课：Variant 转换与运算分派

**目标：** 追踪 GDScript 运算与 convert/var2str/str2var 如何进入 Godot 1.1 的 Variant 运算和构造函数。

## 本课要回答的问题

GDScript 运算 opcode → Variant::evaluate → 运算符/类型分支；convert → Variant::construct；var2str/str2var → 序列化与解析

## C++ 调用链

~~~text
GDScript 运算 opcode → Variant::evaluate → 运算符/类型分支；convert → Variant::construct；var2str/str2var → 序列化与解析
~~~

## C++ 源码位置

- `engine/godot-1.1/modules/gdscript/gd_script.cpp:327-350`：本课追踪摘录。
- `engine/godot-1.1/core/variant_op.cpp:219-280`：本课追踪摘录。
- `engine/godot-1.1/core/variant.cpp:197-270`：本课追踪摘录。
- `engine/godot-1.1/core/variant_call.cpp:921-1015`：本课追踪摘录。
- `engine/godot-1.1/modules/gdscript/gd_functions.cpp:500-520`：本课追踪摘录。
- `engine/godot-1.1/modules/gdscript/gd_functions.cpp:608-620`：本课追踪摘录。

## 本课源码复刻

课内文件保留对应上游源码行段正文，并在段首标出原始行号。摘录用于逐行追踪，不是独立编译单元。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | Godot 源码 | 上游行段 |
| --- | --- | --- |
| [variant.cpp](src/upstream/core/variant.cpp.excerpt) | godot-1.1/core/variant.cpp | 197-270 |
| [variant_call.cpp](src/upstream/core/variant_call.cpp.excerpt) | godot-1.1/core/variant_call.cpp | 921-1015 |
| [variant_op.cpp](src/upstream/core/variant_op.cpp.excerpt) | godot-1.1/core/variant_op.cpp | 219-280 |
| [gd_functions.cpp](src/upstream/modules/gdscript/gd_functions.cpp.excerpt) | godot-1.1/modules/gdscript/gd_functions.cpp | 500-520, 608-620 |
| [gd_script.cpp](src/upstream/modules/gdscript/gd_script.cpp.excerpt) | godot-1.1/modules/gdscript/gd_script.cpp | 327-350 |

## 最小 Godot/GDScript 实验

将运行时值作为函数参数参与加法；输出 typeof 和 convert 结果，再往返序列化包含 Vector2 的 Dictionary。

实验工程文件：

- [`engine.cfg`](engine.cfg)
- [`main.xml`](main.xml)
- [`variant_probe.gd`](variant_probe.gd)

## 运行与观察

在本课目录用 Godot 1.1 启动工程。命令中的 godot 需要指向支持本课项目格式的程序；未加入 PATH 时替换为对应 app bundle 内的可执行程序路径。

~~~sh
godot -path .
~~~

**预期观察：** 输出包含运行时参数相加结果、typeof 类型码、字符串转整数结果和 Dictionary 序列化往返值。

**动手改一处：** 将整数与浮点数替换为字符串/数字组合，再对照 `Variant::evaluate` 的加法规则和 `convert()` 的目标类型。

## 简化与边界

Variant 类型、转换兼容矩阵和运算实现以 1.1 快照为准；实验不覆盖全部类型组合和失败分支。

源码引用描述本地快照中的实现；运行日志描述实际运行时行为。两类证据分别记录。
