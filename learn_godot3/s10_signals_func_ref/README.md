# 第 10 课：信号连接与 FuncRef 回调

**目标：** 追踪 Godot 3.6 旧式 signal-to-object/method 连接、emit_signal 分派和 FuncRef 的 ID+函数名调用。

## 本课增量

复刻 signal connection 的 ObjectID/方法名登记与 Object::call；另用 FuncRef 的 ID+函数名路径回调。

**本课要回答：** Object::connect(signal,target,method) → 连接表 → emit_signal → 目标方法；funcref → FuncRef(ObjectID,function) → call_func → Object::call

## C++ 源码追踪

源码依据：`engine/godot-3.6/`。以下路径相对于该快照目录；准确原文见后续摘录表。

```text
Object::connect(signal, target, method) → connection list
  → Object::emit_signal → Object::call
funcref → FuncRef(ObjectID, function) → call_func → ObjectDB lookup → Object::call
```

- `core/object.cpp:1172-1265` **`Object::emit_signal()`**：按 signal 取连接并把发射参数与连接绑定参数交给目标方法。
- `core/object.cpp:1452-1510` **`Object::connect()`**：检查 signal/target/method 组合及连接标志，再保存连接信息。
- `core/func_ref.cpp:33-101` **`FuncRef::call_func()` / `call_funcv()`**：FuncRef 保存对象引用和函数名，调用时解析对象并执行方法。
- `modules/gdscript/gdscript_functions.cpp:592-615`、`1760-1766`：`funcref()` 创建脚本可见 FuncRef，并绑定 `call_func` 接口。

模型显式表现重复连接拒绝、发射参数转发与 FuncRef 的 ObjectID 查找；不模拟线程组和 deferred 连接。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [func_ref.cpp](src/upstream/core/func_ref.cpp) | [33-101](src/upstream/core/func_ref.cpp.excerpt) | engine/godot-3.6/core/func_ref.cpp |
| 2 | [object.cpp](src/upstream/core/object.cpp) | [1172-1265 ; 1452-1510](src/upstream/core/object.cpp.excerpt) | engine/godot-3.6/core/object.cpp |
| 3 | [gdscript_functions.cpp](src/upstream/modules/gdscript/gdscript_functions.cpp) | [592-615 ; 1760-1766](src/upstream/modules/gdscript/gdscript_functions.cpp.excerpt) | engine/godot-3.6/modules/gdscript/gdscript_functions.cpp |

## GDScript 源码复刻

`src/source_replay.gd` 按本课列出的 C++ 入口重建关键数据结构、条件分支和状态更新。它是可逐步阅读的教学移植，不是完整引擎替身；模型函数表会标明直接对应的源码行为和仅用于组织输入/输出的脚手架。平台、线程、对象分配和服务器副作用仍由真实引擎处理。

| 模型函数 | C++ 源码对照或脚手架性质 | 复现的状态与分支 |
| --- | --- | --- |
| `_connect()` | `Object::connect / connection table duplicate checks` | 检查重复目标后把 signal 与回调元数据登记到连接表。 |
| `_emit()` | `Object::emit_signal → target Object::call` | 为匹配 signal 取连接项并同步调用目标回调。 |
| `_call_func()` | `FuncRef::call_func / call_funcv` | 从 FuncRef 保存的 ObjectID/函数名发起调用。 |
| `_call_object()` | `ObjectDB::get_instance → Object::call` | 按 ObjectID 找目标对象，再模拟 Object::call/callp。 |

## 最小 Godot/GDScript 实验

尝试重复连接同一 signal/target/method，发射自定义 signal，再创建 FuncRef 调用脚本方法，比较连接错误、参数转发和显式调用。

实验工程文件：

- [`main.tscn`](main.tscn)
- [`project.godot`](project.godot)
- [`signal_probe.gd`](signal_probe.gd)

## 运行与观察

在本课目录用 Godot 3.6 启动工程。命令中的 godot 需要指向支持本课项目格式的程序；未加入 PATH 时替换为对应 app bundle 内的可执行程序路径。

~~~sh
godot --path .
~~~

**预期观察：** 第一次 connect 成功、重复连接返回错误；随后看到 signal 接收函数日志和 FuncRef.call_func 结果，两条路径都进入目标对象方法。

**动手改一处：** 将 signal 参数改为两个值，并将 FuncRef 指向另一个方法，比较连接参数转发与 `call_func()` 参数传递。

## 简化与边界

Godot 3.6 使用 connect(signal, object, method) 和 FuncRef；Godot 4 使用 Callable 风格连接。

源码引用描述本地快照中的实现；运行日志描述实际运行时行为。两类证据分别记录。

## 下一课

继续阅读 [s11_reference_ownership](../s11_reference_ownership/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
