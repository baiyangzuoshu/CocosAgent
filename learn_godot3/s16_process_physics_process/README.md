# 第 16 课：_process、_physics_process 与优先级

**目标：** 追踪 Node 的 idle/physics process 标记、优先级和 SceneTree 两阶段迭代。

## 本课问题

_process 与 _physics_process 如何由不同处理队列驱动？priority 影响哪一层顺序？

## C++ 源码追踪

以下行号相对于仓库本地 `engine/godot-3.6/` 快照。
- `engine/godot-3.6/scene/main/node.cpp:52-186, 486-500, 936-950, 976-999`：摘录包含本课的关键函数实现。
- `engine/godot-3.6/scene/main/scene_tree.cpp:578-610, 621-734`：摘录包含本课的关键函数实现。

调用链：`set_process/set_physics_process/set_process_priority → process lists → SceneTree::iteration → idle()/physics notifications → Node::_notification`

## 源码阅读顺序

1. `Node::set_process` / physics-process 开关将节点加入或移出对应处理列表；优先级用于同类处理节点排序。
2. `SceneTree::iteration`（Godot 3）或 `SceneTree::process`（Godot 4）将物理帧与普通帧处理分开调度。
3. `Node::_notification` 承接调度结果并调用 GDScript 回调；运行日志中的 delta 用来辨认两条路径，不作为严格帧率保证。

SceneTree 将固定物理步和 idle 帧分开迭代，Node 的启用标记决定是否接收相应通知；同类处理按处理优先级排序。GDScript 同时打印两类 delta，体现节奏不同，不把处理顺序的单次输出当成硬实时保证。

## 最小 Godot/GDScript 实验

开启 _process 与 _physics_process，打印前几次 delta，并设置 process_priority；到达回调数后退出。

实验文件：

- [`project.godot`](project.godot)
- [`main.tscn`](main.tscn)
- [`process_probe.gd`](process_probe.gd)

## 运行与观察

在本课目录用匹配本代的 Godot 程序运行：

```sh
godot --path .
```

**预期观察：** 预期两种回调都出现，physics delta 接近项目物理步长；实际顺序和帧耗时需记录本机运行结果。

**动手改一处：** 将 process_priority 设为更早/更晚的值，并挂第二个处理节点比较同类回调顺序。

## 简化与边界

实验限制为主场景普通 Node 的脚本回调，不测 worker thread、内部通知、低处理器模式或固定步补帧上限。

未在本次静态检查中启动该项目；源码事实与预期输出分开记录。

## 本课 C++ 源码摘录

课内 `src/upstream/` 复制本课对应的上游行段并标出原始行号，供逐段追踪；完整源码上下文仍以只读 engine 快照为准。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | 上游文件 | 行号 |
| --- | --- | --- |
| [node.cpp](src/upstream/scene/main/node.cpp.excerpt) | `engine/godot-3.6/scene/main/node.cpp` | 52-186, 486-500, 936-950, 976-999 |
| [scene_tree.cpp](src/upstream/scene/main/scene_tree.cpp.excerpt) | `engine/godot-3.6/scene/main/scene_tree.cpp` | 578-610, 621-734 |

## 下一课

[第 17 课：节点组分派与暂停模式](../s17_pause_groups/README.md)
