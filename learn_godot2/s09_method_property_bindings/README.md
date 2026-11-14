# 第 9 课：MethodBind、属性绑定与脚本动态访问

**目标：** 从 Node2D 的绑定表追到 ObjectTypeDB，再观察 callv 和 transform/pos 如何到达 C++ setter/getter。

## 本课增量

复刻 ObjectTypeDB 中 Node2D 的 MethodBind 表；属性 pos 通过 setter/getter 映射，动态 callv 检查参数个数。

**本课要回答：** Node2D::_bind_methods → ObjectTypeDB 方法/属性注册 → Object::set/get → ObjectTypeDB 属性访问 → Object::callv → MethodBind

## C++ 源码追踪

源码依据：`engine/godot-2.1/`（Godot 2.1 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

~~~text
Node2D::_bind_methods → ObjectTypeDB 方法/属性注册 → Object::set/get → ObjectTypeDB 属性访问 → Object::callv → MethodBind
~~~
- `engine/godot-2.1/scene/2d/node_2d.cpp:398-455`：本课追踪摘录。
- `engine/godot-2.1/core/object_type_db.cpp:614-701`：本课追踪摘录。
- `engine/godot-2.1/core/object.cpp:305-398`：本课追踪摘录。
- `engine/godot-2.1/core/object.cpp:652-670`：本课追踪摘录。
- `engine/godot-2.1/core/object.cpp:797-859`：本课追踪摘录。
- `engine/godot-2.1/core/object.cpp:1527-1534`：本课追踪摘录。
- `engine/godot-2.1/core/object.cpp:1594-1597`：本课追踪摘录。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [object.cpp](src/upstream/core/object.cpp) | [305-398 ; 652-670 ; 797-859 ; 1527-1534 ; 1594-1597](src/upstream/core/object.cpp.excerpt) | engine/godot-2.1/core/object.cpp |
| 2 | [object_type_db.cpp](src/upstream/core/object_type_db.cpp) | [614-701](src/upstream/core/object_type_db.cpp.excerpt) | engine/godot-2.1/core/object_type_db.cpp |
| 3 | [node_2d.cpp](src/upstream/scene/2d/node_2d.cpp) | [398-455](src/upstream/scene/2d/node_2d.cpp.excerpt) | engine/godot-2.1/scene/2d/node_2d.cpp |

## GDScript 源码复刻

S09 Godot 2.1: ObjectTypeDB property metadata delegates to MethodBind callv.

source_replay.gd 按本课指定快照复刻控制流与状态传递，模型中的状态字段、函数入口和 API 名称对应本代 C++ 路径。根目录实验脚本先运行模型，再调用对应版本的 Godot API。

| GDScript 函数 | 复刻步骤 |
| --- | --- |
| _register_method() | 登记 MethodBind 参数数、getter/setter 或属性路径 |
| _register_property() | 登记 MethodBind 参数数、getter/setter 或属性路径 |
| _callv() | 通过绑定表动态调用方法或访问属性 |
| _get_property() | 通过绑定表动态调用方法或访问属性 |
| _set_property() | 通过绑定表动态调用方法或访问属性 |

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
