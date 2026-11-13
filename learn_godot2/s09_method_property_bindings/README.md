# 第 9 课：MethodBind、属性绑定与脚本动态访问

**目标：** 从 Node2D 的绑定表追到 ObjectTypeDB，再观察 callv 和 transform/pos 如何到达 C++ setter/getter。

## 本课要回答的问题

Node2D::_bind_methods → ObjectTypeDB 方法/属性注册 → Object::set/get → ObjectTypeDB 属性访问 → Object::callv → MethodBind

## C++ 调用链

~~~text
Node2D::_bind_methods → ObjectTypeDB 方法/属性注册 → Object::set/get → ObjectTypeDB 属性访问 → Object::callv → MethodBind
~~~

## C++ 源码位置

- `engine/godot-2.1/scene/2d/node_2d.cpp:398-455`：本课追踪摘录。
- `engine/godot-2.1/core/object_type_db.cpp:614-701`：本课追踪摘录。
- `engine/godot-2.1/core/object.cpp:305-398`：本课追踪摘录。
- `engine/godot-2.1/core/object.cpp:652-670`：本课追踪摘录。
- `engine/godot-2.1/core/object.cpp:797-859`：本课追踪摘录。
- `engine/godot-2.1/core/object.cpp:1527-1534`：本课追踪摘录。
- `engine/godot-2.1/core/object.cpp:1594-1597`：本课追踪摘录。

## 本课源码复刻

课内文件保留对应上游源码行段正文，并在段首标出原始行号。摘录用于逐行追踪，不是独立编译单元。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | Godot 源码 | 上游行段 |
| --- | --- | --- |
| [object.cpp](src/upstream/core/object.cpp.excerpt) | godot-2.1/core/object.cpp | 305-398, 652-670, 797-859, 1527-1534, 1594-1597 |
| [object_type_db.cpp](src/upstream/core/object_type_db.cpp.excerpt) | godot-2.1/core/object_type_db.cpp | 614-701 |
| [node_2d.cpp](src/upstream/scene/2d/node_2d.cpp.excerpt) | godot-2.1/scene/2d/node_2d.cpp | 398-455 |

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
