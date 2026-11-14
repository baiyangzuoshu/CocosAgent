# 第 20 课：Spatial 局部/全局变换与通知

**目标：** 沿 Spatial::set_transform 和全局变换传播观察 3D 节点父子坐标关系。

## 本课问题

translation 与 global_translation 分别代表什么？Transform 更新通知怎样传播到子节点？

## C++ 源码追踪

以下行号相对于仓库本地 `engine/godot-3.6/` 快照。
- `engine/godot-3.6/scene/3d/spatial.cpp:145-260, 284-296, 298-302, 486-493`：摘录包含本课的关键函数实现。

调用链：`Spatial::set_transform/set_translation → dirty transform notification → parent global transform × local transform → child update`

## 源码阅读顺序

1. `Spatial::set_transform/set_translation` 更新局部 Transform 并标记全局变换需要重算。
2. `Spatial::_notification` 处理变换变化并传播依赖；读取 global_translation 时观察父级与本地变换的组合。
3. Spatial 只提供场景坐标层级；本课没有 Mesh、Camera 或 PhysicsBody，因此不把坐标变换误认为物理/渲染同步。

3D 节点缓存本地与全局 Transform。父子关系变化使全局矩阵按层级组合，并通过本代 notification/dirty 标记传播。Godot 1/2/3 的类名为 Spatial；Godot 4 改为 Node3D。

## 最小 Godot/GDScript 实验

创建父子 Spatial，设置 parent.translation=(3,0,0)、child.translation=(2,0,0)，打印 child.global_translation。

实验文件：

- [`project.godot`](project.godot)
- [`main.tscn`](main.tscn)
- [`transform3d_probe.gd`](transform3d_probe.gd)

## 运行与观察

在本课目录用匹配本代的 Godot 程序运行：

```sh
godot --path .
```

**预期观察：** 无旋转/缩放时预期 global_translation 为 (5,0,0)。

**动手改一处：** 旋转 parent 后复读 child.global_translation，预测父变换对局部位移的旋转作用。

## 简化与边界

只观察 Spatial 坐标树；不覆盖 VisualInstance、相机、物理对象同步或 Godot 4 Node3D。

未在本次静态检查中启动该项目；源码事实与预期输出分开记录。

## 本课 C++ 源码摘录

课内 `src/upstream/` 复制本课对应的上游行段并标出原始行号，供逐段追踪；完整源码上下文仍以只读 engine 快照为准。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | 上游文件 | 行号 |
| --- | --- | --- |
| [spatial.cpp](src/upstream/scene/3d/spatial.cpp.excerpt) | `engine/godot-3.6/scene/3d/spatial.cpp` | 145-260, 284-296, 298-302, 486-493 |

## 下一课

S20 完成本组节点与变换主题；后续主题见本课程[大纲](../课程大纲.md)。
