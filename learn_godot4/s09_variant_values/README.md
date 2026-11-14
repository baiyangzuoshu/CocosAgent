# 第 9 课：Variant 内置类型与动态值

**目标：** 追踪 Godot 4.7 Variant 类型枚举、严格构造转换、GDScript utility 注册和文本序列化。

## 本课增量

复刻 Variant::construct 的成功/失败、文本往返和 Object::callp setter，区分 Variant utility 与对象方法调用。

**本课要回答：** Variant::Type → can_convert_strict/construct → typeof/type_string/type_convert → var_to_str/str_to_var → VariantWriter/Parser

## C++ 源码追踪

源码依据：`engine/godot-4.7/`。以下路径相对于该快照目录；准确原文见后续摘录表。

```text
Variant::Type → can_convert_strict/construct → type_convert
Object::callv(Array) → Object::callp → ScriptInstance / ClassDB MethodBind
var_to_str → VariantWriter；str_to_var → VariantParser
```

- `core/variant/variant.h:96-145`：Godot 4.7 的 `Variant::Type` 已包含 `FLOAT`、`VECTOR2I`、`CALLABLE` 与 typed packed arrays。
- `core/variant/variant.cpp:189-228`、`532-862`、`variant_construct.cpp:264-289`：宽松/严格转换表与构造器候选检查分开；strict 构造按参数数和严格类型匹配候选，字符串数字不会按 strict 表转为数值。
- `core/variant/variant_utility.cpp:845-933`：`typeof()` 与 `type_convert()` 使用本代 Variant 类型枚举；`type_convert()` 的实际转换不等同于构造器选择。
- `core/object/object.cpp:750-850`：`Object::callv()` 组装参数指针并进入 `callp()`；脚本实例未命中后再查 ClassDB MethodBind。
- `core/variant/variant_utility.cpp:1037-1053`、`1747-1765`：`var_to_str/str_to_var` 绑定 `VariantWriter` 与 `VariantParser`。

实验分别观察类型、类型转换、文本往返和动态对象调用；模型不把这些入口合并成单一“Variant 转换”。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [object.cpp](src/upstream/core/object/object.cpp) | [750-765 ; 768-850](src/upstream/core/object/object.cpp.excerpt) | engine/godot-4.7/core/object/object.cpp |
| 2 | [variant.cpp](src/upstream/core/variant/variant.cpp) | [189-228 ; 532-862](src/upstream/core/variant/variant.cpp.excerpt) | engine/godot-4.7/core/variant/variant.cpp |
| 3 | [variant.h](src/upstream/core/variant/variant.h) | [96-145](src/upstream/core/variant/variant.h.excerpt) | engine/godot-4.7/core/variant/variant.h |
| 4 | [variant_construct.cpp](src/upstream/core/variant/variant_construct.cpp) | [264-289](src/upstream/core/variant/variant_construct.cpp.excerpt) | engine/godot-4.7/core/variant/variant_construct.cpp |
| 5 | [variant_utility.cpp](src/upstream/core/variant/variant_utility.cpp) | [845-933 ; 1037-1053 ; 1747-1765](src/upstream/core/variant/variant_utility.cpp.excerpt) | engine/godot-4.7/core/variant/variant_utility.cpp |

## GDScript 源码复刻

`src/source_replay.gd` 按本课列出的 C++ 入口重建关键数据结构、条件分支和状态更新。它是可逐步阅读的教学移植，不是完整引擎替身；模型函数表会标明直接对应的源码行为和仅用于组织输入/输出的脚手架。平台、线程、对象分配和服务器副作用仍由真实引擎处理。

| 模型函数 | C++ 源码对照或脚手架性质 | 复现的状态与分支 |
| --- | --- | --- |
| `_construct()` | `Variant::construct` | 按目标 Variant 类型匹配构造或转换路径。 |
| `_can_convert_strict()` | `Variant::can_convert_strict` | 按目标类型的严格兼容表判断构造参数，不把 String 当数字自动转换。 |
| `_type_convert()` | `VariantUtilityFunctions::type_convert` | 模拟面向脚本的 type_convert utility；与构造器 strict 匹配分开。 |
| `_var_to_str()` | `VariantUtilityFunctions::var_to_str / VariantWriter::write_to_string` | 序列化 Variant 值到文本。 |
| `_str_to_var()` | `VariantUtilityFunctions::str_to_var / VariantParser::parse` | 解析文本并恢复 Variant 值。 |
| `_object_callp()` | `Object::callv → Object::callp → ClassDB::get_method` | 把参数数组转给 Object::callp/MethodBind。 |

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
