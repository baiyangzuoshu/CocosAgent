# 第 9 课：Variant 类型、构造转换与动态调用

**目标：** 把 GDScript typeof/convert、Variant 构造与 Object.callv 串起来，观察动态值和原生对象调用共用 Variant 参数。

## 本课增量

复刻 Variant 的运行时类型标签、转换和 ADD，再将 Variant 参数数组送进 Object::callv，区分值运算与对象分派。

**本课要回答：** typeof/convert → gdscript_functions → Variant::construct/can_convert；Object.callv(Array) → Object::call → ScriptInstance 或 ClassDB MethodBind

## C++ 源码追踪

源码依据：`engine/godot-3.6/`（Godot 3.6 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

~~~text
typeof/convert → gdscript_functions → Variant::construct/can_convert；Object.callv(Array) → Object::call → ScriptInstance 或 ClassDB MethodBind
~~~
- `engine/godot-3.6/core/variant.h:58-110`：本课追踪摘录。
- `engine/godot-3.6/core/variant.cpp:162-210`：本课追踪摘录。
- `engine/godot-3.6/core/variant_call.cpp:1217-1285`：本课追踪摘录。
- `engine/godot-3.6/core/object.cpp:819-900`：本课追踪摘录。
- `engine/godot-3.6/modules/gdscript/gdscript_function.cpp:432-455`：本课追踪摘录。
- `engine/godot-3.6/modules/gdscript/gdscript_function.cpp:947-970`：本课追踪摘录。
- `engine/godot-3.6/modules/gdscript/gdscript_functions.cpp:616-638`：本课追踪摘录。
- `engine/godot-3.6/modules/gdscript/gdscript_functions.cpp:1768-1779`：本课追踪摘录。
- `engine/godot-3.6/modules/gdscript/gdscript_functions.cpp:1859-1869`：本课追踪摘录。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [object.cpp](src/upstream/core/object.cpp) | [819-900](src/upstream/core/object.cpp.excerpt) | engine/godot-3.6/core/object.cpp |
| 2 | [variant.cpp](src/upstream/core/variant.cpp) | [162-210](src/upstream/core/variant.cpp.excerpt) | engine/godot-3.6/core/variant.cpp |
| 3 | [variant.h](src/upstream/core/variant.h) | [58-110](src/upstream/core/variant.h.excerpt) | engine/godot-3.6/core/variant.h |
| 4 | [variant_call.cpp](src/upstream/core/variant_call.cpp) | [1217-1285](src/upstream/core/variant_call.cpp.excerpt) | engine/godot-3.6/core/variant_call.cpp |
| 5 | [gdscript_function.cpp](src/upstream/modules/gdscript/gdscript_function.cpp) | [432-455 ; 947-970](src/upstream/modules/gdscript/gdscript_function.cpp.excerpt) | engine/godot-3.6/modules/gdscript/gdscript_function.cpp |
| 6 | [gdscript_functions.cpp](src/upstream/modules/gdscript/gdscript_functions.cpp) | [616-638 ; 1768-1779 ; 1859-1869](src/upstream/modules/gdscript/gdscript_functions.cpp.excerpt) | engine/godot-3.6/modules/gdscript/gdscript_functions.cpp |

## GDScript 源码复刻

S09 Godot 3.6: Variant tags and convert/evaluate stay separate from Object::callv.

source_replay.gd 按本课指定快照复刻控制流与状态传递，模型中的状态字段、函数入口和 API 名称对应本代 C++ 路径。根目录实验脚本先运行模型，再调用对应版本的 Godot API。

| GDScript 函数 | 复刻步骤 |
| --- | --- |
| _variant() | 维护 Variant 类型标签并执行构造/转换/序列化分支 |
| _convert() | 维护 Variant 类型标签并执行构造/转换/序列化分支 |
| _evaluate_add() | 维护 Variant 类型标签并执行构造/转换/序列化分支 |
| _object_callv() | 更新本课状态并向后续步骤传递结果 |
| _variant_to_text() | 维护 Variant 类型标签并执行构造/转换/序列化分支 |

## 最小 Godot/GDScript 实验

观察 null、bool、int、float、String、Vector2、Dictionary；执行 convert，并用 callv 调 Node2D.set_position。

实验工程文件：

- [`main.tscn`](main.tscn)
- [`project.godot`](project.godot)
- [`variant_probe.gd`](variant_probe.gd)

## 运行与观察

在本课目录用 Godot 3.6 启动工程。命令中的 godot 需要指向支持本课项目格式的程序；未加入 PATH 时替换为对应 app bundle 内的可执行程序路径。

~~~sh
godot --path .
~~~

**预期观察：** 输出 Variant 类型码、转换后的整数、序列化往返值，以及 callv 修改 Node2D 位置后的读回值。

**动手改一处：** 在类型数组中加入 `Color` 或 `Rect2`，并改写 `callv` 的位置参数，分别追踪 Variant 分类和 Object 方法调用。

## 简化与边界

Variant 内置值与对象方法调用是两条路径。var2str/str2var 展示文本往返，不涉及不可信数据反序列化策略。

源码引用描述本地快照中的实现；运行日志描述实际运行时行为。两类证据分别记录。

## 下一课

继续阅读 [s10_signals_func_ref](../s10_signals_func_ref/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
