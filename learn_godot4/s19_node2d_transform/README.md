# 第 19 课：Node2D 变换与 CanvasItem 更新

**目标：** 追踪 Node2D 的局部 transform 更新、父级组合与 CanvasItem 渲染端通知。

## 本课问题

position 写入如何更新 transform？全局变换从哪里组合父级矩阵？

## C++ 源码追踪

以下行号相对于仓库本地 `engine/godot-4.7/` 快照。
- `engine/godot-4.7/scene/2d/node_2d.cpp:139-146, 159-166, 298-307`：摘录包含本课的关键函数实现。

调用链：`Node2D::set_position → _update_transform → cached Transform2D → parent transform → RenderingServer canvas item update`

## 源码阅读顺序

1. `Node2D::set_position` 改本地位置并更新/标脏局部变换；`get_global_transform` 把父级矩阵乘到本地矩阵。
2. `CanvasItem` 负责 2D 画布层级通知和服务器更新（Godot 4 经过 RenderingServer）；Node2D 并不直接画出 Sprite。
3. 无旋转缩放时 `(10,20)+(3,4)=(13,24)`；修改父级旋转或缩放后，用矩阵乘法解释结果为何不再是简单相加。

Node2D 保存本地变换并根据父 CanvasItem 计算全局变换；更新路径将变换交给画布渲染接口。Godot 1/2 使用 set_pos/get_pos/get_global_pos；Godot 3/4 使用 position/global_position。

## 最小 Godot/GDScript 实验

动态创建父子 Node2D，父 position=(10,20)、子 position=(3,4)，打印 child.position 与 child.global_position。

实验文件：

- [`project.godot`](project.godot)
- [`main.tscn`](main.tscn)
- [`transform2d_probe.gd`](transform2d_probe.gd)

## 运行与观察

在本课目录用匹配本代的 Godot 程序运行：

```sh
godot --path .
```

**预期观察：** 预期局部值为 (3,4)，无旋转/缩放时全局位置为 (13,24)。

**动手改一处：** 改为调用 child.set_global_position，比较引擎反算出的 local position。

## 简化与边界

实验不测 CanvasItem draw command、SubViewport、CanvasLayer 或渲染后端；只观察公开 2D 变换。

未在本次静态检查中启动该项目；源码事实与预期输出分开记录。

## 本课 C++ 源码摘录

课内 `src/upstream/` 复制本课对应的上游行段并标出原始行号，供逐段追踪；完整源码上下文仍以只读 engine 快照为准。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | 上游文件 | 行号 |
| --- | --- | --- |
| [node_2d.cpp](src/upstream/scene/2d/node_2d.cpp.excerpt) | `engine/godot-4.7/scene/2d/node_2d.cpp` | 139-146, 159-166, 298-307 |

## 下一课

[第 20 课：Node3D 局部/全局变换与父级传播](../s20_node3d_transform/README.md)
