# 第 9 课：MethodBind、属性绑定与脚本动态访问

**目标：** 从 Node2D 的绑定表追到 Object::set/get/callv，弄清脚本属性路径与 C++ setter/getter 的映射。

## 本课要回答的问题

Node2D::_bind_methods → ObjectTypeDB::bind_method/ADD_PROPERTY → Object::set/get → ObjectTypeDB 属性表 → Object::callv → MethodBind::call

## C++ 调用链

~~~text
Node2D::_bind_methods → ObjectTypeDB::bind_method/ADD_PROPERTY → Object::set/get → ObjectTypeDB 属性表 → Object::callv → MethodBind::call
~~~

## C++ 源码位置

- `engine/godot-1.1/scene/2d/node_2d.cpp:360-405`：本课追踪摘录。
- `engine/godot-1.1/core/object_type_db.cpp:637-701`：本课追踪摘录。
- `engine/godot-1.1/core/object.cpp:311-405`：本课追踪摘录。
- `engine/godot-1.1/core/object.cpp:685-704`：本课追踪摘录。
- `engine/godot-1.1/core/object.cpp:835-897`：本课追踪摘录。
- `engine/godot-1.1/core/object.cpp:1435-1443`：本课追踪摘录。
- `engine/godot-1.1/core/object.cpp:1505-1509`：本课追踪摘录。

## 本课源码复刻

课内文件保留对应上游源码行段正文，并在段首标出原始行号。摘录用于逐行追踪，不是独立编译单元。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | Godot 源码 | 上游行段 |
| --- | --- | --- |
| [object.cpp](src/upstream/core/object.cpp.excerpt) | godot-1.1/core/object.cpp | 311-405, 685-704, 835-897, 1435-1443, 1505-1509 |
| [object_type_db.cpp](src/upstream/core/object_type_db.cpp.excerpt) | godot-1.1/core/object_type_db.cpp | 637-701 |
| [node_2d.cpp](src/upstream/scene/2d/node_2d.cpp.excerpt) | godot-1.1/scene/2d/node_2d.cpp | 360-405 |

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
