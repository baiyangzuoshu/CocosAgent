# 第 20 课：Spatial 局部变换与父子全局变换

**目标：** 追踪 Spatial 本地 Transform、父节点变换组合和全局 Transform 更新。

## 本课问题

set_translation 写入本地变换的哪个字段？global transform 如何继承父 Spatial？

## C++ 源码追踪

以下行号相对于仓库本地 `engine/godot-2.1/` 快照。
- `engine/godot-2.1/scene/3d/spatial.cpp:116-218, 220-231, 233-241, 326-333`：摘录包含本课的关键函数实现。

调用链：`Spatial::set_translation / set_transform → transform notification → parent global Transform × local Transform → descendants`

## 源码阅读顺序

1. `Spatial::set_translation` 把平移写入本地 Transform；`set_transform` 统一处理本地矩阵变更。
2. `Spatial::_notification` 接收进入树及变换变脏通知，更新全局 Transform 并向依赖子节点传播。
3. 父子无旋转缩放时全局位置为 `(3,0,0)+(2,0,0)`；旋转父节点后必须按 Transform 相乘，不能只加 translation。

3D 节点缓存本地与全局 Transform。父子关系变化使全局矩阵按层级组合，并通过本代 notification/dirty 标记传播。Godot 1/2/3 的类名为 Spatial；Godot 4 改为 Node3D。

## 最小 Godot/GDScript 实验

创建父子 Spatial，父 translation=(3,0,0)，子 translation=(2,0,0)，打印 child.translation 与 global transform origin。

实验文件：

- [`engine.cfg`](engine.cfg)
- [`main.tscn`](main.tscn)
- [`transform3d_probe.gd`](transform3d_probe.gd)

## 运行与观察

在本课目录用匹配本代的 Godot 程序运行：

```sh
godot -path .
```

**预期观察：** 无旋转/缩放时预期 local translation 为 (2,0,0)，global transform origin 为 (5,0,0)。

**动手改一处：** 旋转父 Spatial 后再次读全局变换，说明为什么不能继续简单相加向量。

## 简化与边界

不创建 MeshInstance/Camera/World，不覆盖非均匀缩放、骨架或 3D 渲染服务器。

未在本次静态检查中启动该项目；源码事实与预期输出分开记录。

## 本课 C++ 源码摘录

课内 `src/upstream/` 复制本课对应的上游行段并标出原始行号，供逐段追踪；完整源码上下文仍以只读 engine 快照为准。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | 上游文件 | 行号 |
| --- | --- | --- |
| [spatial.cpp](src/upstream/scene/3d/spatial.cpp.excerpt) | `engine/godot-2.1/scene/3d/spatial.cpp` | 116-218, 220-231, 233-241, 326-333 |

## 下一课

S20 完成本组节点与变换主题；后续主题见本课程[大纲](../课程大纲.md)。
