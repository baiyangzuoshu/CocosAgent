# 第 10 课：Variant 转换与运算分派

**目标：** 追踪 GDScript 运算与 convert/var2str/str2var 如何进入 Godot 1.1 的 Variant 运算和构造函数。

## 本课增量

复刻旧版 GDScript 运算进入 Variant::evaluate 的类型分支，并展示构造转换、除零错误和文本输出。

**本课要回答：** GDScript 运算 opcode → Variant::evaluate → 运算符/类型分支；convert → Variant::construct；var2str/str2var → 序列化与解析

## C++ 源码追踪

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

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [variant.cpp](src/upstream/core/variant.cpp) | [197-270](src/upstream/core/variant.cpp.excerpt) | engine/godot-1.1/core/variant.cpp |
| 2 | [variant_call.cpp](src/upstream/core/variant_call.cpp) | [921-1015](src/upstream/core/variant_call.cpp.excerpt) | engine/godot-1.1/core/variant_call.cpp |
| 3 | [variant_op.cpp](src/upstream/core/variant_op.cpp) | [219-280](src/upstream/core/variant_op.cpp.excerpt) | engine/godot-1.1/core/variant_op.cpp |
| 4 | [gd_functions.cpp](src/upstream/modules/gdscript/gd_functions.cpp) | [500-520 ; 608-620](src/upstream/modules/gdscript/gd_functions.cpp.excerpt) | engine/godot-1.1/modules/gdscript/gd_functions.cpp |
| 5 | [gd_script.cpp](src/upstream/modules/gdscript/gd_script.cpp) | [327-350](src/upstream/modules/gdscript/gd_script.cpp.excerpt) | engine/godot-1.1/modules/gdscript/gd_script.cpp |

## GDScript 源码复刻

S10 Godot 1.1: GDScript opcode selects Variant::evaluate, then construct/serialization.

source_replay.gd 按本课指定快照复刻控制流与状态传递，模型中的状态字段、函数入口和 API 名称对应本代 C++ 路径。根目录实验脚本先运行模型，再调用对应版本的 Godot API。

| GDScript 函数 | 复刻步骤 |
| --- | --- |
| _evaluate() | 维护 Variant 类型标签并执行构造/转换/序列化分支 |
| _construct_string() | 维护 Variant 类型标签并执行构造/转换/序列化分支 |

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

## 下一课

继续阅读 [s11_object_signals](../s11_object_signals/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
