# 第 9 课：Variant 类型、构造转换与动态调用

**目标：** 把 GDScript typeof/convert、Variant 构造与 Object.callv 串起来，观察动态值和原生对象调用共用 Variant 参数。

## 本课增量

复刻 Variant 的运行时类型标签、转换和 ADD，再将 Variant 参数数组送进 Object::callv，区分值运算与对象分派。

## 本课问题

typeof/convert → gdscript_functions → Variant::construct/can_convert；Object.callv(Array) → Object::call → ScriptInstance 或 ClassDB MethodBind

## 源码调用链

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

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-3.6` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [object.cpp](src/upstream/core/object.cpp) | [摘录](src/upstream/core/object.cpp.excerpt) | `engine/godot-3.6/core/object.cpp` | 819-900 |
| 2 | [variant.cpp](src/upstream/core/variant.cpp) | [摘录](src/upstream/core/variant.cpp.excerpt) | `engine/godot-3.6/core/variant.cpp` | 162-210 |
| 3 | [variant.h](src/upstream/core/variant.h) | [摘录](src/upstream/core/variant.h.excerpt) | `engine/godot-3.6/core/variant.h` | 58-110 |
| 4 | [variant_call.cpp](src/upstream/core/variant_call.cpp) | [摘录](src/upstream/core/variant_call.cpp.excerpt) | `engine/godot-3.6/core/variant_call.cpp` | 1217-1285 |
| 5 | [gdscript_function.cpp](src/upstream/modules/gdscript/gdscript_function.cpp) | [摘录](src/upstream/modules/gdscript/gdscript_function.cpp.excerpt) | `engine/godot-3.6/modules/gdscript/gdscript_function.cpp` | 432-455, 947-970 |
| 6 | [gdscript_functions.cpp](src/upstream/modules/gdscript/gdscript_functions.cpp) | [摘录](src/upstream/modules/gdscript/gdscript_functions.cpp.excerpt) | `engine/godot-3.6/modules/gdscript/gdscript_functions.cpp` | 616-638, 1768-1779 |

## GDScript 源码复刻与 C++ 对照

模型创建带运行时类型标签的 Variant，执行 INT→REAL 转换和 ADD，再将 Variant 参数数组交给对象 setter；两种分派路径分开显示。

src/upstream/ 保存本课引用的完整上游文件副本和带原始行号的摘录；src/source_replay.gd 执行表中的教学模型。先观察模型如何改变状态或走分支，再回到对应 C++ 函数核对。模型不替代 C++，也不代表引擎运行时本身。

| C++ 追踪阶段 | 模型函数 | 运行时要观察什么 |
| --- | --- | --- |
| Variant type / convert / evaluate | _variant() → _convert() → _evaluate_add() | 观察 INT 转 REAL 后结果类型仍由运算分支决定 |
| Object::callv | _object_callv() | 把 Vector2 参数放进 Variant 数组并调用 setter |
| var2str utility | _variant_to_text() | 把模型 Variant 数值变为可读文本 |

独立项目入口先调用 source_replay.gd，再执行真实 Godot API 实验。实验脚本：variant_probe.gd。模型输出是确定性的教学数据；只有实际用对应版本 Godot 运行后，才能记录为引擎实验验证。
## 最小 Godot/GDScript 实验

观察 null、bool、int、float、String、Vector2、Dictionary；执行 convert，并用 callv 调 Node2D.set_position。

实验工程文件：

- [`main.tscn`](main.tscn)
- [`project.godot`](project.godot)
- [`variant_probe.gd`](variant_probe.gd)

## 运行与预期观察

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
