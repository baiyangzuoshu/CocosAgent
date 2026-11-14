# 第 19 课：Node2D 变换、CanvasItem 与 2D 绘制

**目标：** 追踪 Node2D 本地矩阵变化如何合并父 CanvasItem 变换，并提交到 VisualServer。

## 本课问题

set_pos 改的是哪层坐标？父节点移动后 child 的全局位置如何变化？

## C++ 源码追踪

以下行号相对于仓库本地 `engine/godot-2.1/` 快照。
- `engine/godot-2.1/scene/2d/node_2d.cpp:119-131, 133-140, 272-282`：摘录包含本课的关键函数实现。
- `engine/godot-2.1/scene/2d/canvas_item.cpp:452-501`：摘录包含本课的关键函数实现。

调用链：`Node2D::set_pos → _update_transform → parent CanvasItem transform × local transform → CanvasItem/VisualServer update`

## 源码阅读顺序

1. `Node2D::set_pos` 更新本地位置并使变换缓存失效；读 `_update_transform` 看局部矩阵如何建立。
2. `CanvasItem` 组合父级变换并处理变换变化通知，渲染服务器收到更新后才知道 2D 画布项目的新状态。
3. 运行实验保持旋转与缩放为单位值，所以父子全局位置可直接相加；这只是局部线性变换的特例。

Node2D 保存本地变换并根据父 CanvasItem 计算全局变换；更新路径将变换交给画布渲染接口。Godot 1/2 使用 set_pos/get_pos/get_global_pos；Godot 3/4 使用 position/global_position。

## 最小 Godot/GDScript 实验

动态创建父子 Node2D，父位置设为 (10,20)，子位置设为 (3,4)，打印子局部 get_pos 与 get_global_pos。

实验文件：

- [`engine.cfg`](engine.cfg)
- [`main.tscn`](main.tscn)
- [`transform2d_probe.gd`](transform2d_probe.gd)

## 运行与观察

在本课目录用匹配本代的 Godot 程序运行：

```sh
godot -path .
```

**预期观察：** 预期局部位置保持 (3,4)，父子无旋转/缩放时全局位置为 (13,24)。

**动手改一处：** 将父节点移动后再次读取 global position，区分 local position 不变与 global position 重算。

## 简化与边界

无旋转、缩放、CanvasLayer 和 viewport camera；只读坐标关系，不绘制 Sprite 资源。

未在本次静态检查中启动该项目；源码事实与预期输出分开记录。

## 本课 C++ 源码摘录

课内 `src/upstream/` 复制本课对应的上游行段并标出原始行号，供逐段追踪；完整源码上下文仍以只读 engine 快照为准。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | 上游文件 | 行号 |
| --- | --- | --- |
| [node_2d.cpp](src/upstream/scene/2d/node_2d.cpp.excerpt) | `engine/godot-2.1/scene/2d/node_2d.cpp` | 119-131, 133-140, 272-282 |
| [canvas_item.cpp](src/upstream/scene/2d/canvas_item.cpp.excerpt) | `engine/godot-2.1/scene/2d/canvas_item.cpp` | 452-501 |

## 下一课

[第 20 课：Spatial 局部变换与父子全局变换](../s20_spatial_transform/README.md)
