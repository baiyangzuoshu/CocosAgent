# 第 9 课：MethodBind、属性绑定与脚本动态访问

**目标：** 从 Node2D 的绑定表追到 Object::set/get/callv，弄清脚本属性路径与 C++ setter/getter 的映射。

## 本课问题

Node2D::_bind_methods → ObjectTypeDB::bind_method/ADD_PROPERTY → Object::set/get → ObjectTypeDB 属性表 → Object::callv → MethodBind::call

## 源码调用链

源码依据：`engine/godot-1.1/`（Godot 1.1 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

~~~text
Node2D::_bind_methods → ObjectTypeDB::bind_method/ADD_PROPERTY → Object::set/get → ObjectTypeDB 属性表 → Object::callv → MethodBind::call
~~~
- `engine/godot-1.1/scene/2d/node_2d.cpp:360-405`：本课追踪摘录。
- `engine/godot-1.1/core/object_type_db.cpp:637-701`：本课追踪摘录。
- `engine/godot-1.1/core/object.cpp:311-405`：本课追踪摘录。
- `engine/godot-1.1/core/object.cpp:685-704`：本课追踪摘录。
- `engine/godot-1.1/core/object.cpp:835-897`：本课追踪摘录。
- `engine/godot-1.1/core/object.cpp:1435-1443`：本课追踪摘录。
- `engine/godot-1.1/core/object.cpp:1505-1509`：本课追踪摘录。

## 本课源码复刻

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-1.1` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [object.cpp](src/upstream/core/object.cpp) | [摘录](src/upstream/core/object.cpp.excerpt) | `engine/godot-1.1/core/object.cpp` | 311-405 |
| 2 | [object_type_db.cpp](src/upstream/core/object_type_db.cpp) | [摘录](src/upstream/core/object_type_db.cpp.excerpt) | `engine/godot-1.1/core/object_type_db.cpp` | 637-701 |
| 3 | [node_2d.cpp](src/upstream/scene/2d/node_2d.cpp) | [摘录](src/upstream/scene/2d/node_2d.cpp.excerpt) | `engine/godot-1.1/scene/2d/node_2d.cpp` | 360-405 |

## 可运行源码复刻

课程代码 [`src/source_replay.gd`](src/source_replay.gd) 按本课 C++ 函数关系实现一个小型 GDScript 模型；入口脚本会先运行它，再执行下面的真实引擎 API 实验。阅读时把模型中的状态变化逐步映射到上方的 C++ 摘录。模型只复刻本课选出的路径，不声称等同于完整 Godot 引擎。

## 最小 Godot/GDScript 实验

同一个 Node2D 分别走方法绑定和旧式属性路径：has_method、callv、get/set，并读回向量。

实验工程文件：

- [`binding_probe.gd`](binding_probe.gd)
- [`engine.cfg`](engine.cfg)
- [`main.xml`](main.xml)

## 运行与预期观察

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
