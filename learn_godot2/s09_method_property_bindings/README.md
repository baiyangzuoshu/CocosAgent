# 第 9 课：MethodBind、属性绑定与脚本动态访问

**目标：** 从 Node2D 的绑定表追到 ObjectTypeDB，再观察 callv 和 transform/pos 如何到达 C++ setter/getter。

## 本课增量

复刻 ObjectTypeDB 中 Node2D 的 MethodBind 表；属性 pos 通过 setter/getter 映射，动态 callv 检查参数个数。

**本课要回答：** Node2D::_bind_methods → ObjectTypeDB 方法/属性注册 → Object::set/get → ObjectTypeDB 属性访问 → Object::callv → MethodBind

## C++ 源码追踪

源码依据：`engine/godot-2.1/`。以下路径相对于该快照目录；准确原文见后续摘录表。

```text
Node2D::_bind_methods / ADD_PROPERTY
  → Object::set/get
  → ObjectTypeDB::set_property/get_property
  → Object::callv/call → MethodBind
```

- `scene/2d/node_2d.cpp:360-405` **`Node2D::_bind_methods()`**：注册位置方法，并把 `transform/pos` 属性接到 `set_pos/get_pos`。
- `core/object.cpp` 的 `Object::set()` / `Object::get()`：先询问脚本实例，再将内建属性交给类型数据库。
- `core/object_type_db.cpp:637-701` **`ObjectTypeDB::set_property()` / `get_property()`**：沿父类元数据查找属性，并通过 setter/getter 更新或读取值。
- `core/object.cpp:685-704`、`835-897` **`Object::callv()` / `Object::call()`**：将 Array 变成 Variant 参数数组，脚本未处理的方法再进入 MethodBind。

模型把类型表、属性表、参数数量校验和方法调用分开；真实探针通过 Godot 2.1 的位置属性 API 观察读写结果。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [object.cpp](src/upstream/core/object.cpp) | [305-398 ; 652-670 ; 797-859 ; 1527-1534 ; 1594-1597](src/upstream/core/object.cpp.excerpt) | engine/godot-2.1/core/object.cpp |
| 2 | [object_type_db.cpp](src/upstream/core/object_type_db.cpp) | [614-701](src/upstream/core/object_type_db.cpp.excerpt) | engine/godot-2.1/core/object_type_db.cpp |
| 3 | [node_2d.cpp](src/upstream/scene/2d/node_2d.cpp) | [398-455](src/upstream/scene/2d/node_2d.cpp.excerpt) | engine/godot-2.1/scene/2d/node_2d.cpp |

## GDScript 源码复刻

`src/source_replay.gd` 按本课列出的 C++ 入口重建关键数据结构、条件分支和状态更新。它是可逐步阅读的教学移植，不是完整引擎替身；模型函数表会标明直接对应的源码行为和仅用于组织输入/输出的脚手架。平台、线程、对象分配和服务器副作用仍由真实引擎处理。

| 模型函数 | C++ 源码对照或脚手架性质 | 复现的状态与分支 |
| --- | --- | --- |
| `_register_method()` | `ObjectTypeDB::bind_method / MethodBind` | 登记方法名、参数个数与原生处理函数。 |
| `_register_property()` | `Node2D::_bind_methods / ADD_PROPERTY` | 登记属性名以及 setter/getter 方法名。 |
| `_callv()` | `Object::callv → Object::call → MethodBind::call` | 校验参数并把动态参数转到对应 MethodBind/脚本方法。 |
| `_get_property()` | `Object::get → ObjectTypeDB::get_property` | 通过属性元数据的 getter MethodBind 取值。 |
| `_set_property()` | `Object::set → ObjectTypeDB::set_property` | 通过属性元数据的 setter MethodBind 写值。 |

## 最小 Godot/GDScript 实验

分别走动态方法调用和属性读写路径，观察 set_pos/get_pos、transform/pos 与 Vector2。

实验工程文件：

- [`binding_probe.gd`](binding_probe.gd)
- [`engine.cfg`](engine.cfg)
- [`main.tscn`](main.tscn)

## 运行与观察

在本课目录用 Godot 2.1 启动工程。命令中的 godot 需要指向支持本课项目格式的程序；未加入 PATH 时替换为对应 app bundle 内的可执行程序路径。

~~~sh
godot -path .
~~~

**预期观察：** set_pos 可通过 has_method 检查并由 callv 调用；transform/pos 读写与 get_pos 返回值一致。

**动手改一处：** 将 `set_pos` 换成另一个已绑定方法，预测 `has_method`、`callv` 和属性读回各自经过的路径。

## 简化与边界

只追踪 Godot 2.1 的 ObjectTypeDB 与旧 Node2D API；Godot 3/4 已改用 ClassDB 和新版属性名。

源码引用描述本地快照中的实现；运行日志描述实际运行时行为。两类证据分别记录。

## 下一课

继续阅读 [s10_variant_dispatch](../s10_variant_dispatch/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
