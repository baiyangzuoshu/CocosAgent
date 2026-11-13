# 第 9 课：Variant 内置类型与动态值

**目标：** 追踪 Godot 4.7 Variant 类型枚举、严格构造转换、GDScript utility 注册和文本序列化。

## 本课要回答的问题

Variant::Type → can_convert_strict/construct → typeof/type_string/type_convert → var_to_str/str_to_var → VariantWriter/Parser

## C++ 调用链

~~~text
Variant::Type → can_convert_strict/construct → typeof/type_string/type_convert → var_to_str/str_to_var → VariantWriter/Parser
~~~

## C++ 源码位置

- `engine/godot-4.7/core/variant/variant.h:96-145`：本课追踪摘录。
- `engine/godot-4.7/core/variant/variant.cpp:189-228`：本课追踪摘录。
- `engine/godot-4.7/core/variant/variant_construct.cpp:264-289`：本课追踪摘录。
- `engine/godot-4.7/core/variant/variant_utility.cpp:845-933`：本课追踪摘录。
- `engine/godot-4.7/core/variant/variant_utility.cpp:1037-1053`：本课追踪摘录。
- `engine/godot-4.7/core/variant/variant_utility.cpp:1747-1765`：本课追踪摘录。
- `engine/godot-4.7/core/object/object.cpp:750-765`：本课追踪摘录。
- `engine/godot-4.7/core/object/object.cpp:768-850`：本课追踪摘录。

## 本课源码复刻

课内文件保留对应上游源码行段正文，并在段首标出原始行号。摘录用于逐行追踪，不是独立编译单元。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | Godot 源码 | 上游行段 |
| --- | --- | --- |
| [object.cpp](src/upstream/core/object/object.cpp.excerpt) | godot-4.7/core/object/object.cpp | 750-765, 768-850 |
| [variant.cpp](src/upstream/core/variant/variant.cpp.excerpt) | godot-4.7/core/variant/variant.cpp | 189-228 |
| [variant.h](src/upstream/core/variant/variant.h.excerpt) | godot-4.7/core/variant/variant.h | 96-145 |
| [variant_construct.cpp](src/upstream/core/variant/variant_construct.cpp.excerpt) | godot-4.7/core/variant/variant_construct.cpp | 264-289 |
| [variant_utility.cpp](src/upstream/core/variant/variant_utility.cpp.excerpt) | godot-4.7/core/variant/variant_utility.cpp | 845-933, 1037-1053, 1747-1765 |

## 最小 Godot/GDScript 实验

遍历不同 Variant 类型，用 type_string(typeof(...)) 标注；转换 String 为 int，并把含 Vector2i 的 Dictionary 做文本往返。

实验工程文件：

- [`main.tscn`](main.tscn)
- [`project.godot`](project.godot)
- [`variant_probe.gd`](variant_probe.gd)

## 运行与观察

在本课目录用 Godot 4.7 启动工程。命令中的 godot 需要指向支持本课项目格式的程序；未加入 PATH 时替换为对应 app bundle 内的可执行程序路径。

~~~sh
godot --path .
~~~

**预期观察：** 输出 int、Vector2i、Dictionary 类型名，字符串 42 转成整数，并显示序列化往返后的 Dictionary。

**动手改一处：** 将 `Vector2i` 换成 `Vector3`，再将序列化字典中的一个字段改成 `Array`，观察 Variant 类型名和文本往返结果。

## 简化与边界

聚焦 Variant 内置值；Object 方法调用与 Callable 由同系列其他课追踪。文本解析行为以本地 4.7 快照为准。

源码引用描述本地快照中的实现；运行日志描述实际运行时行为。两类证据分别记录。
