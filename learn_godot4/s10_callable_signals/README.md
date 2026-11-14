# 第 10 课：Callable 与 Signal 调用链

**目标：** 追踪 Godot 4.7 的 Callable 表示、connect(Callable) 登记，以及 emit_signalp 如何调用连接目标。

## 本课增量

复刻 Callable 的对象/方法/绑定参数、连接重复检查、Signal 发射和 callp 参数合并。

**本课要回答：** GDScript 方法引用 → Callable → Object::connect → signal_map → emit_signalp → Callable::callp → Object::callp/GDScript

## C++ 源码追踪

源码依据：`engine/godot-4.7/`。以下路径相对于该快照目录；准确原文见后续摘录表。

```text
GDScript method reference → Callable
Object::connect → SignalData slot
Object::emit_signalp → Callable::callp → Object::callp
```

- `core/variant/callable.cpp:44-72` **`Callable::callp()`**：从 Callable 的对象身份解析 ObjectDB 实例，再调用对象方法；`callv()` 在 `74-87` 将 Array 转成参数指针。
- `core/variant/variant.h:922-940` **`Callable::bind()`**：模板入口把已绑定参数交给 Callable bind 实现。
- `core/object/object.cpp:1179-1315` **`Object::emit_signalp()`**：在锁内复制连接 Callable/flags，离开锁后再逐项调用；避免回调期间断开连接影响本次发射。
- `core/object/object.cpp:1518-1583` **`Object::connect()`**：检查信号和重复连接；重复比较使用 base comparator，因此 bind 参数不区分连接身份。
- `core/object/object.cpp:768-850` **`Object::callp()`**：先问 ScriptInstance；只有脚本未处理该方法时才查 ClassDB MethodBind。
- `core/variant/variant.h:922-940`：确认本代 Variant 可承载 Callable 与 Signal 值。

GDScript 模型记录对象/方法/绑定参数、按 base identity 检查重复连接、发射时复制连接列表再调用；实验用 Signal.connect/emit 与 Callable.bind 验证公开行为。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [object.cpp](src/upstream/core/object/object.cpp) | [768-850 ; 1179-1221 ; 1233-1315 ; 1518-1583](src/upstream/core/object/object.cpp.excerpt) | engine/godot-4.7/core/object/object.cpp |
| 2 | [callable.cpp](src/upstream/core/variant/callable.cpp) | [44-87](src/upstream/core/variant/callable.cpp.excerpt) | engine/godot-4.7/core/variant/callable.cpp |
| 3 | [variant.h](src/upstream/core/variant/variant.h) | [922-940](src/upstream/core/variant/variant.h.excerpt) | engine/godot-4.7/core/variant/variant.h |

## GDScript 源码复刻

`src/source_replay.gd` 按本课列出的 C++ 入口重建关键数据结构、条件分支和状态更新。它是可逐步阅读的教学移植，不是完整引擎替身；模型函数表会标明直接对应的源码行为和仅用于组织输入/输出的脚手架。平台、线程、对象分配和服务器副作用仍由真实引擎处理。

| 模型函数 | C++ 源码对照或脚手架性质 | 复现的状态与分支 |
| --- | --- | --- |
| `_make_callable()` | `Callable::Callable / Callable::bind` | 组成对象、方法和绑定参数三元组。 |
| `_connect()` | `Object::connect / SignalData connection list` | 检查重复目标后把 signal 与回调元数据登记到连接表。 |
| `_same_callable()` | `Callable identity/equality fields` | 按 base comparator 比较对象和方法身份；本代信号重复检查忽略 bound 参数。 |
| `_emit()` | `Object::emit_signalp / connection snapshot` | 为匹配 signal 取连接项并同步调用目标回调。 |
| `_callp()` | `Callable::callp → Object::callp` | 合并发射参数与 bound 参数后分派目标方法。 |

## 最小 Godot/GDScript 实验

把方法引用封装为 Callable 并连接 Signal，发射整型参数；再对同一方法连接两个不同 bound 值，观察重复连接键忽略 bind 参数；最后直接调用 bind 后的 Callable。

实验工程文件：

- [`main.tscn`](main.tscn)
- [`project.godot`](project.godot)
- [`signal_probe.gd`](signal_probe.gd)

## 运行与观察

在本课目录用 Godot 4.7 启动工程。命令中的 godot 需要指向支持本课项目格式的程序；未加入 PATH 时替换为对应 app bundle 内的可执行程序路径。

~~~sh
godot --path .
~~~

**预期观察：** 信号发射同步调用 GDScript 方法；同一方法即使绑定了不同参数，第二次连接仍返回 `ERR_INVALID_PARAMETER`；Callable 直接调用和 bind 后调用输出计算结果。

**动手改一处：** 把 `bind(5)` 改成绑定另一个整数，并改变 signal 发射值，分别预测连接回调和部分应用 Callable 的结果。

## 简化与边界

展示普通同步连接及 Callable.bind。延迟、一次性、线程组、RPC 和自定义 Callable 后端以完整源码为准。

源码引用描述本地快照中的实现；运行日志描述实际运行时行为。两类证据分别记录。

## 下一课

继续阅读 [s11_refcounted_resource_lifetime](../s11_refcounted_resource_lifetime/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
