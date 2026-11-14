# 第 9 课：MethodBind、属性绑定与脚本动态访问

**目标：** 从 Node2D 的绑定表追到 ObjectTypeDB，再观察 callv 和 transform/pos 如何到达 C++ setter/getter。

## 本课增量

复刻 ObjectTypeDB 中 Node2D 的 MethodBind 表；属性 pos 通过 setter/getter 映射，动态 callv 检查参数个数。

## 本课问题

Node2D::_bind_methods → ObjectTypeDB 方法/属性注册 → Object::set/get → ObjectTypeDB 属性访问 → Object::callv → MethodBind

## 源码调用链

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

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-2.1` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [object.cpp](src/upstream/core/object.cpp) | [摘录](src/upstream/core/object.cpp.excerpt) | `engine/godot-2.1/core/object.cpp` | 305-398 |
| 2 | [object_type_db.cpp](src/upstream/core/object_type_db.cpp) | [摘录](src/upstream/core/object_type_db.cpp.excerpt) | `engine/godot-2.1/core/object_type_db.cpp` | 614-701 |
| 3 | [node_2d.cpp](src/upstream/scene/2d/node_2d.cpp) | [摘录](src/upstream/scene/2d/node_2d.cpp.excerpt) | `engine/godot-2.1/scene/2d/node_2d.cpp` | 398-455 |

## GDScript 源码复刻与 C++ 对照

模型以 MethodBind 表记录方法参数和实现，再让属性读写经 getter/setter 进入 callv；Godot 1/2 的 Node2D 属性名保留为 pos。

src/upstream/ 保存本课引用的完整上游文件副本和带原始行号的摘录；src/source_replay.gd 执行表中的教学模型。先观察模型如何改变状态或走分支，再回到对应 C++ 函数核对。模型不替代 C++，也不代表引擎运行时本身。

| C++ 追踪阶段 | 模型函数 | 运行时要观察什么 |
| --- | --- | --- |
| Node2D::_bind_methods / Object::callv | _bind_method() → _callv() | 验证 set_pos/get_pos 参数计数及属性访问走同一绑定表 |
| Object::_set / Object::_get | _set_property() / _get_property() | 属性 pos 经 setter/getter 写入并回读 |
| ObjectTypeDB::get_method_bind | binds 字典 | 区分方法名查找、参数检查和 native 实现 |

独立项目入口先调用 source_replay.gd，再执行真实 Godot API 实验。实验脚本：binding_probe.gd。模型输出是确定性的教学数据；只有实际用对应版本 Godot 运行后，才能记录为引擎实验验证。
## 最小 Godot/GDScript 实验

分别走动态方法调用和属性读写路径，观察 set_pos/get_pos、transform/pos 与 Vector2。

实验工程文件：

- [`binding_probe.gd`](binding_probe.gd)
- [`engine.cfg`](engine.cfg)
- [`main.tscn`](main.tscn)

## 运行与预期观察

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
