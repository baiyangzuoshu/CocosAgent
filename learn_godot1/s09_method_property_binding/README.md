# 第 9 课：MethodBind、属性绑定与脚本动态访问

**目标：** 从 Node2D 的绑定表追到 Object::set/get/callv，弄清脚本属性路径与 C++ setter/getter 的映射。

## 本课增量

复刻 ObjectTypeDB 中 Node2D 的 MethodBind 表；属性 pos 通过 setter/getter 映射，动态 callv 检查参数个数。

**本课要回答：** Node2D::_bind_methods → ObjectTypeDB::bind_method/ADD_PROPERTY → Object::set/get → ObjectTypeDB 属性表 → Object::callv → MethodBind::call

## C++ 源码追踪

源码依据：`engine/godot-1.1/`。以下路径相对于该快照目录；准确原文见后续摘录表。

```text
Node2D::_bind_methods / ADD_PROPERTY
  → Object::set/get
  → ObjectTypeDB::set_property/get_property
  → Object::callv/call
  → MethodBind
```

- `scene/2d/node_2d.cpp:360-405` **`Node2D::_bind_methods()`**：将 `set_pos/get_pos` 注册为方法，并用 `ADD_PROPERTY` 把 `transform/pos` 映射到 setter/getter。
- `core/object.cpp:311-405` **`Object::set()` / `Object::get()`**：脚本属性先交给 ScriptInstance；没有处理时才查询原生属性表。
- `core/object_type_db.cpp:637-701` **`ObjectTypeDB::set_property()` / `get_property()`**：沿运行时类型及父类查属性元数据，找到 setter/getter 后通过 Object 调用。
- `core/object.cpp:685-704`、`835-897` **`Object::callv()` / `Object::call()`**：把 Array 参数转换为 Variant 参数指针，优先调用脚本方法，随后查 MethodBind。

实验将 `transform/pos` 写入和读回；复刻模型保留属性表、参数数量校验及 setter/getter 分派。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [object.cpp](src/upstream/core/object.cpp) | [311-405 ; 685-704 ; 835-897 ; 1435-1443 ; 1505-1509](src/upstream/core/object.cpp.excerpt) | engine/godot-1.1/core/object.cpp |
| 2 | [object_type_db.cpp](src/upstream/core/object_type_db.cpp) | [637-701](src/upstream/core/object_type_db.cpp.excerpt) | engine/godot-1.1/core/object_type_db.cpp |
| 3 | [node_2d.cpp](src/upstream/scene/2d/node_2d.cpp) | [360-405](src/upstream/scene/2d/node_2d.cpp.excerpt) | engine/godot-1.1/scene/2d/node_2d.cpp |

## GDScript 源码复刻

`src/source_replay.gd` 按本课列出的 C++ 入口重建关键数据结构、条件分支和状态更新。它是可逐步阅读的教学移植，不是完整引擎替身；模型函数表会标明直接对应的源码行为和仅用于组织输入/输出的脚手架。平台、线程、对象分配和服务器副作用仍由真实引擎处理。

| 模型函数 | C++ 源码对照或脚手架性质 | 复现的状态与分支 |
| --- | --- | --- |
| `_bind_property()` | `Node2D::_bind_methods / ADD_PROPERTY` | 登记属性到 setter/getter 的映射。 |
| `_callv()` | `Object::callv → Object::call → MethodBind::call` | 校验参数并把动态参数转到对应 MethodBind/脚本方法。 |
| `_get()` | `Object::get → ObjectTypeDB::get_property` | 按 ScriptInstance、内建属性、原生字段顺序读取属性。 |
| `_set()` | `Object::set → ObjectTypeDB::set_property` | 按 ScriptInstance、内建属性、原生字段顺序写入属性。 |

## 最小 Godot/GDScript 实验

同一个 Node2D 分别走方法绑定和旧式属性路径：has_method、callv、get/set，并读回向量。

实验工程文件：

- [`binding_probe.gd`](binding_probe.gd)
- [`engine.cfg`](engine.cfg)
- [`main.xml`](main.xml)

## 运行与观察

在本课目录用 Godot 1.1 启动工程。命令中的 godot 需要指向支持本课项目格式的程序；未加入 PATH 时替换为对应 app bundle 内的可执行程序路径。

~~~sh
godot -path .
~~~

**预期观察：** set_pos 已注册；callv 写入 transform/pos 后能读回，set/get 与 get_pos 也返回最终 Vector2。

**动手改一处：** 将 `Vector2(12, 24)` 换成另一组坐标，分别预测 `callv`、`get/set` 与 `get_pos()` 的读回值。

## 简化与边界

本实验依赖 Godot 1.1 的 ObjectTypeDB、set_pos 和 transform/pos 名称。摘录不是独立编译单元；错误处理和属性继承以完整源码为准。

源码引用描述本地快照中的实现；运行日志描述实际运行时行为。两类证据分别记录。

## 下一课

继续阅读 [s10_variant_dispatch](../s10_variant_dispatch/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
