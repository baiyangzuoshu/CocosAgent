# 第 9 课：Variant 内置类型与动态值

**目标：** 追踪 Godot 4.7 Variant 类型枚举、严格构造转换、GDScript utility 注册和文本序列化。

## 本课增量

复刻 Variant::construct 的成功/失败、文本往返和 Object::callp setter，区分 Variant utility 与对象方法调用。

**本课要回答：** Variant::Type → can_convert_strict/construct → typeof/type_string/type_convert → var_to_str/str_to_var → VariantWriter/Parser

## C++ 源码追踪

源码依据：`engine/godot-4.7/`（Godot 4.7 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

~~~text
Variant::Type → can_convert_strict/construct → typeof/type_string/type_convert → var_to_str/str_to_var → VariantWriter/Parser
~~~
- `engine/godot-4.7/core/variant/variant.h:96-145`：本课追踪摘录。
- `engine/godot-4.7/core/variant/variant.cpp:189-228`：本课追踪摘录。
- `engine/godot-4.7/core/variant/variant_construct.cpp:264-289`：本课追踪摘录。
- `engine/godot-4.7/core/variant/variant_utility.cpp:845-933`：本课追踪摘录。
- `engine/godot-4.7/core/variant/variant_utility.cpp:1037-1053`：本课追踪摘录。
- `engine/godot-4.7/core/variant/variant_utility.cpp:1747-1765`：本课追踪摘录。
- `engine/godot-4.7/core/object/object.cpp:750-765`：本课追踪摘录。
- `engine/godot-4.7/core/object/object.cpp:768-850`：本课追踪摘录。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [object.cpp](src/upstream/core/object/object.cpp) | [750-765 ; 768-850](src/upstream/core/object/object.cpp.excerpt) | engine/godot-4.7/core/object/object.cpp |
| 2 | [variant.cpp](src/upstream/core/variant/variant.cpp) | [189-228](src/upstream/core/variant/variant.cpp.excerpt) | engine/godot-4.7/core/variant/variant.cpp |
| 3 | [variant.h](src/upstream/core/variant/variant.h) | [96-145](src/upstream/core/variant/variant.h.excerpt) | engine/godot-4.7/core/variant/variant.h |
| 4 | [variant_construct.cpp](src/upstream/core/variant/variant_construct.cpp) | [264-289](src/upstream/core/variant/variant_construct.cpp.excerpt) | engine/godot-4.7/core/variant/variant_construct.cpp |
| 5 | [variant_utility.cpp](src/upstream/core/variant/variant_utility.cpp) | [845-933 ; 1037-1053 ; 1747-1765](src/upstream/core/variant/variant_utility.cpp.excerpt) | engine/godot-4.7/core/variant/variant_utility.cpp |

## GDScript 源码复刻

S09 Godot 4.7: strict Variant construction, utility text round-trip, Object::callp.

source_replay.gd 按本课指定快照复刻控制流与状态传递，模型中的状态字段、函数入口和 API 名称对应本代 C++ 路径。根目录实验脚本先运行模型，再调用对应版本的 Godot API。

| GDScript 函数 | 复刻步骤 |
| --- | --- |
| _construct() | 维护 Variant 类型标签并执行构造/转换/序列化分支 |
| _is_integer() | 维护 Variant 类型标签并执行构造/转换/序列化分支 |
| _var_to_str() | 维护 Variant 类型标签并执行构造/转换/序列化分支 |
| _str_to_var() | 维护 Variant 类型标签并执行构造/转换/序列化分支 |
| _object_callp() | 更新本课状态并向后续步骤传递结果 |

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

## 下一课

继续阅读 [s10_callable_signals](../s10_callable_signals/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
