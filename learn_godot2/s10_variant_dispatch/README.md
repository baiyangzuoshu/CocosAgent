# 第 10 课：Variant 转换与运算分派

**目标：** 沿 GDScript 运算 opcode、Variant::evaluate、Variant::construct 和类型转换 builtin 追踪动态值。

## 本课增量

复刻旧版 GDScript 运算进入 Variant::evaluate 的类型分支，并展示构造转换、除零错误和文本输出。

**本课要回答：** GDScript opcode → Variant::evaluate；convert → Variant::construct/can_convert；var2str/str2var → Variant writer/parser

## C++ 源码追踪

源码依据：`engine/godot-2.1/`。以下路径相对于该快照目录；准确原文见后续摘录表。

```text
GDScript operator bytecode → Variant::evaluate
convert(type) → Variant::construct / Variant::can_convert
var2str/str2var → VariantWriter / VariantParser
```

- `modules/gdscript/gd_function.cpp:312-340`：运行时运算 opcode 把 operator 与两个 Variant 操作数交给 `Variant::evaluate()`。
- `core/variant_op.cpp:238-300` **`Variant::evaluate()`**：根据 operator 和 Variant 类型组合分派计算；非法类型组合通过 `valid` 与 CallError 路径上报。
- `core/variant.cpp:198-270` **`Variant::can_convert()`**、`core/variant_call.cpp:1017-1110` **`Variant::construct()`**：分别决定转换许可和构造结果。
- `modules/gdscript/gd_functions.cpp:507-530`、`621-635`：`typeof/convert` 和 `var2str/str2var` builtin；文本 builtin 在该函数内直接调用 VariantWriter/VariantParser。

本课复刻只覆盖数字/字符串加法、除法边界和 STRING 构造；其余运算矩阵仍以快照为准。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [variant.cpp](src/upstream/core/variant.cpp) | [198-270](src/upstream/core/variant.cpp.excerpt) | engine/godot-2.1/core/variant.cpp |
| 2 | [variant_call.cpp](src/upstream/core/variant_call.cpp) | [1017-1110](src/upstream/core/variant_call.cpp.excerpt) | engine/godot-2.1/core/variant_call.cpp |
| 3 | [variant_op.cpp](src/upstream/core/variant_op.cpp) | [238-300](src/upstream/core/variant_op.cpp.excerpt) | engine/godot-2.1/core/variant_op.cpp |
| 4 | [gd_function.cpp](src/upstream/modules/gdscript/gd_function.cpp) | [312-340](src/upstream/modules/gdscript/gd_function.cpp.excerpt) | engine/godot-2.1/modules/gdscript/gd_function.cpp |
| 5 | [gd_functions.cpp](src/upstream/modules/gdscript/gd_functions.cpp) | [507-530 ; 621-635](src/upstream/modules/gdscript/gd_functions.cpp.excerpt) | engine/godot-2.1/modules/gdscript/gd_functions.cpp |

## GDScript 源码复刻

`src/source_replay.gd` 按本课列出的 C++ 入口重建关键数据结构、条件分支和状态更新。它是可逐步阅读的教学移植，不是完整引擎替身；模型函数表会标明直接对应的源码行为和仅用于组织输入/输出的脚手架。平台、线程、对象分配和服务器副作用仍由真实引擎处理。

| 模型函数 | C++ 源码对照或脚手架性质 | 复现的状态与分支 |
| --- | --- | --- |
| `_evaluate()` | `GDScript operator opcode → Variant::evaluate` | 按运算符和左右 Variant 标签选择计算分支。 |
| `_construct()` | `Variant::construct / Variant::can_convert` | 按目标 Variant 类型匹配构造或转换路径。 |

## 最小 Godot/GDScript 实验

用函数参数触发运行时加法，比较类型码与转换结果，再往返序列化包含 Vector2 的 Dictionary。

实验工程文件：

- [`engine.cfg`](engine.cfg)
- [`main.tscn`](main.tscn)
- [`variant_probe.gd`](variant_probe.gd)

## 运行与观察

在本课目录用 Godot 2.1 启动工程。命令中的 godot 需要指向支持本课项目格式的程序；未加入 PATH 时替换为对应 app bundle 内的可执行程序路径。

~~~sh
godot -path .
~~~

**预期观察：** 日志显示运行时加法、typeof 类型码、字符串转整数及 Dictionary 序列化往返结果。

**动手改一处：** 改变 `left`、`right` 的 Variant 类型，先依据本代 `Variant::evaluate` 预测加法结果，再运行观察。

## 简化与边界

Godot 2.1 的 Variant 类型与构造器列表以本快照为准；不外推 Godot 3/4 的类型枚举和错误语义。

源码引用描述本地快照中的实现；运行日志描述实际运行时行为。两类证据分别记录。

## 下一课

继续阅读 [s11_signals_notifications](../s11_signals_notifications/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
