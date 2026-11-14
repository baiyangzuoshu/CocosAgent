# 第 9 课：Variant 内置类型与动态值

**目标：** 追踪 Godot 4.7 Variant 类型枚举、严格构造转换、GDScript utility 注册和文本序列化。

## 本课增量

复刻 Variant::construct 的成功/失败、文本往返和 Object::callp setter，区分 Variant utility 与对象方法调用。

## 本课问题

Variant::Type → can_convert_strict/construct → typeof/type_string/type_convert → var_to_str/str_to_var → VariantWriter/Parser

## 源码调用链

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

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-4.7` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [object.cpp](src/upstream/core/object/object.cpp) | [摘录](src/upstream/core/object/object.cpp.excerpt) | `engine/godot-4.7/core/object/object.cpp` | 750-765, 768-850 |
| 2 | [variant.cpp](src/upstream/core/variant/variant.cpp) | [摘录](src/upstream/core/variant/variant.cpp.excerpt) | `engine/godot-4.7/core/variant/variant.cpp` | 189-228 |
| 3 | [variant.h](src/upstream/core/variant/variant.h) | [摘录](src/upstream/core/variant/variant.h.excerpt) | `engine/godot-4.7/core/variant/variant.h` | 96-145 |
| 4 | [variant_construct.cpp](src/upstream/core/variant/variant_construct.cpp) | [摘录](src/upstream/core/variant/variant_construct.cpp.excerpt) | `engine/godot-4.7/core/variant/variant_construct.cpp` | 264-289 |
| 5 | [variant_utility.cpp](src/upstream/core/variant/variant_utility.cpp) | [摘录](src/upstream/core/variant/variant_utility.cpp.excerpt) | `engine/godot-4.7/core/variant/variant_utility.cpp` | 845-933 |

## GDScript 源码复刻与 C++ 对照

模型执行 Variant::construct 成功/失败分支、var_to_str/str_to_var 往返，以及独立的 Object::callp setter 路径。

src/upstream/ 保存本课引用的完整上游文件副本和带原始行号的摘录；src/source_replay.gd 执行表中的教学模型。先观察模型如何改变状态或走分支，再回到对应 C++ 函数核对。模型不替代 C++，也不代表引擎运行时本身。

| C++ 追踪阶段 | 模型函数 | 运行时要观察什么 |
| --- | --- | --- |
| Variant::construct | _construct() / _is_integer() | 比较合法和非法文本转换的成功状态 |
| var_to_str / str_to_var utility | _variant_to_text() / _text_to_variant() | 做简单整数/浮点文本往返 |
| Object::callp | _object_callp() | 单独观察对象 setter 的 Variant 参数入口 |

独立项目入口先调用 source_replay.gd，再执行真实 Godot API 实验。实验脚本：variant_probe.gd。模型输出是确定性的教学数据；只有实际用对应版本 Godot 运行后，才能记录为引擎实验验证。
## 最小 Godot/GDScript 实验

遍历不同 Variant 类型，用 type_string(typeof(...)) 标注；转换 String 为 int，并把含 Vector2i 的 Dictionary 做文本往返。

实验工程文件：

- [`main.tscn`](main.tscn)
- [`project.godot`](project.godot)
- [`variant_probe.gd`](variant_probe.gd)

## 运行与预期观察

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
