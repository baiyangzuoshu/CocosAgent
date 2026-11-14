# 第 10 课：Variant 转换与运算分派

**目标：** 追踪 GDScript 运算与 convert/var2str/str2var 如何进入 Godot 1.1 的 Variant 运算和构造函数。

## 本课问题

GDScript 运算 opcode → Variant::evaluate → 运算符/类型分支；convert → Variant::construct；var2str/str2var → 序列化与解析

## 源码调用链

源码依据：`engine/godot-1.1/`（Godot 1.1 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

~~~text
GDScript 运算 opcode → Variant::evaluate → 运算符/类型分支；convert → Variant::construct；var2str/str2var → 序列化与解析
~~~
- `engine/godot-1.1/modules/gdscript/gd_script.cpp:327-350`：本课追踪摘录。
- `engine/godot-1.1/core/variant_op.cpp:219-280`：本课追踪摘录。
- `engine/godot-1.1/core/variant.cpp:197-270`：本课追踪摘录。
- `engine/godot-1.1/core/variant_call.cpp:921-1015`：本课追踪摘录。
- `engine/godot-1.1/modules/gdscript/gd_functions.cpp:500-520`：本课追踪摘录。
- `engine/godot-1.1/modules/gdscript/gd_functions.cpp:608-620`：本课追踪摘录。

## 本课源码复刻

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-1.1` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [variant.cpp](src/upstream/core/variant.cpp) | [摘录](src/upstream/core/variant.cpp.excerpt) | `engine/godot-1.1/core/variant.cpp` | 197-270 |
| 2 | [variant_call.cpp](src/upstream/core/variant_call.cpp) | [摘录](src/upstream/core/variant_call.cpp.excerpt) | `engine/godot-1.1/core/variant_call.cpp` | 921-1015 |
| 3 | [variant_op.cpp](src/upstream/core/variant_op.cpp) | [摘录](src/upstream/core/variant_op.cpp.excerpt) | `engine/godot-1.1/core/variant_op.cpp` | 219-280 |
| 4 | [gd_functions.cpp](src/upstream/modules/gdscript/gd_functions.cpp) | [摘录](src/upstream/modules/gdscript/gd_functions.cpp.excerpt) | `engine/godot-1.1/modules/gdscript/gd_functions.cpp` | 500-520, 608-620 |
| 5 | [gd_script.cpp](src/upstream/modules/gdscript/gd_script.cpp) | [摘录](src/upstream/modules/gdscript/gd_script.cpp.excerpt) | `engine/godot-1.1/modules/gdscript/gd_script.cpp` | 327-350 |

## 可运行源码复刻

课程代码 [`src/source_replay.gd`](src/source_replay.gd) 按本课 C++ 函数关系实现一个小型 GDScript 模型；入口脚本会先运行它，再执行下面的真实引擎 API 实验。阅读时把模型中的状态变化逐步映射到上方的 C++ 摘录。模型只复刻本课选出的路径，不声称等同于完整 Godot 引擎。

## 最小 Godot/GDScript 实验

将运行时值作为函数参数参与加法；输出 typeof 和 convert 结果，再往返序列化包含 Vector2 的 Dictionary。

实验工程文件：

- [`engine.cfg`](engine.cfg)
- [`main.xml`](main.xml)
- [`variant_probe.gd`](variant_probe.gd)

## 运行与预期观察

在本课目录用 Godot 1.1 启动工程。命令中的 godot 需要指向支持本课项目格式的程序；未加入 PATH 时替换为对应 app bundle 内的可执行程序路径。

~~~sh
godot -path .
~~~

**预期观察：** 输出包含运行时参数相加结果、typeof 类型码、字符串转整数结果和 Dictionary 序列化往返值。

**动手改一处：** 将整数与浮点数替换为字符串/数字组合，再对照 `Variant::evaluate` 的加法规则和 `convert()` 的目标类型。

## 简化与边界

Variant 类型、转换兼容矩阵和运算实现以 1.1 快照为准；实验不覆盖全部类型组合和失败分支。

源码引用描述本地快照中的实现；运行日志描述实际运行时行为。两类证据分别记录。

## 下一课

继续阅读 [s11_object_signals](../s11_object_signals/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
