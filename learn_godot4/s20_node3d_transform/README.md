# 第 20 课：Node3D 局部/全局变换与父级传播

**目标：** 追踪 Node3D 局部 Transform3D、父节点全局变换与 transform_changed 通知。

## 本课问题

position 和 global_position 如何经 parent transform 换算？Node3D 通知会更新哪些子节点缓存？

## C++ 源码追踪

以下行号相对于仓库本地 `engine/godot-4.7/` 快照。
- `engine/godot-4.7/scene/3d/node_3d.cpp:142-314, 399-409, 420-427, 714-722`：摘录包含本课的关键函数实现。

调用链：`Node3D::set_position/set_transform → notification flags → parent global Transform3D × local → global cache and descendants`

## 源码阅读顺序

1. `Node3D::set_position` 修改本地位置，`set_transform` 写入完整 Transform3D 并设置相应 dirty 标记。
2. `Node3D::_notification` 维护 3D 父子登记、全局变换缓存和脏标记传播；`get_global_transform` 才得到组合后的变换。
3. 父子无旋转缩放时全局位置是 `(5,0,0)`；父级旋转后沿矩阵乘法预测 child 的 global_position。

3D 节点缓存本地与全局 Transform。父子关系变化使全局矩阵按层级组合，并通过本代 notification/dirty 标记传播。Godot 1/2/3 的类名为 Spatial；Godot 4 改为 Node3D。

## 最小 Godot/GDScript 实验

创建父子 Node3D，设置 parent.position=(3,0,0)、child.position=(2,0,0)，打印 child.global_position。

实验文件：

- [`project.godot`](project.godot)
- [`main.tscn`](main.tscn)
- [`transform3d_probe.gd`](transform3d_probe.gd)

## 运行与观察

在本课目录用匹配本代的 Godot 程序运行：

```sh
godot --path .
```

**预期观察：** 无旋转/缩放时预期全局位置为 (5,0,0)。

**动手改一处：** 旋转 parent 后复读 global_position，沿 transform 乘法预测结果。

## 简化与边界

不创建 Mesh、相机或渲染服务器实例；不覆盖 transform notification 被忽略、physics interpolation 和 gizmo 更新。

未在本次静态检查中启动该项目；源码事实与预期输出分开记录。

## 本课 C++ 源码摘录

课内 `src/upstream/` 复制本课对应的上游行段并标出原始行号，供逐段追踪；完整源码上下文仍以只读 engine 快照为准。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | 上游文件 | 行号 |
| --- | --- | --- |
| [node_3d.cpp](src/upstream/scene/3d/node_3d.cpp.excerpt) | `engine/godot-4.7/scene/3d/node_3d.cpp` | 142-314, 399-409, 420-427, 714-722 |

## 下一课

S20 完成本组节点与变换主题；后续主题见本课程[大纲](../课程大纲.md)。
