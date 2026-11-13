# 第 9 课：Variant 类型、构造转换与动态调用

**目标：** 把 GDScript typeof/convert、Variant 构造与 Object.callv 串起来，观察动态值和原生对象调用共用 Variant 参数。

## 本课要回答的问题

typeof/convert → gdscript_functions → Variant::construct/can_convert；Object.callv(Array) → Object::call → ScriptInstance 或 ClassDB MethodBind

## C++ 调用链

~~~text
typeof/convert → gdscript_functions → Variant::construct/can_convert；Object.callv(Array) → Object::call → ScriptInstance 或 ClassDB MethodBind
~~~

## C++ 源码位置

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

课内文件保留对应上游源码行段正文，并在段首标出原始行号。摘录用于逐行追踪，不是独立编译单元。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | Godot 源码 | 上游行段 |
| --- | --- | --- |
| [object.cpp](src/upstream/core/object.cpp.excerpt) | godot-3.6/core/object.cpp | 819-900 |
| [variant.cpp](src/upstream/core/variant.cpp.excerpt) | godot-3.6/core/variant.cpp | 162-210 |
| [variant.h](src/upstream/core/variant.h.excerpt) | godot-3.6/core/variant.h | 58-110 |
| [variant_call.cpp](src/upstream/core/variant_call.cpp.excerpt) | godot-3.6/core/variant_call.cpp | 1217-1285 |
| [gdscript_function.cpp](src/upstream/modules/gdscript/gdscript_function.cpp.excerpt) | godot-3.6/modules/gdscript/gdscript_function.cpp | 432-455, 947-970 |
| [gdscript_functions.cpp](src/upstream/modules/gdscript/gdscript_functions.cpp.excerpt) | godot-3.6/modules/gdscript/gdscript_functions.cpp | 616-638, 1768-1779, 1859-1869 |

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
