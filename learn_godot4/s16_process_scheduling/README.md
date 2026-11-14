# 第 16 课：SceneTree process 调度与优先级

**目标：** 追踪 Godot 4.7 的 process/physics process 标志、优先级和 SceneTree::process 分阶段调度。

## 本课问题

普通帧与物理帧如何区分？Node priority 在处理列表中怎样参与排序？

## C++ 源码追踪

以下行号相对于仓库本地 `engine/godot-4.7/` 快照。
- `engine/godot-4.7/scene/main/node.cpp:68-147, 617-637, 1025-1045, 1151-1171`：摘录包含本课的关键函数实现。
- `engine/godot-4.7/scene/main/scene_tree.cpp:688-791`：摘录包含本课的关键函数实现。

调用链：`Node::set_process / set_physics_process / set_process_priority → SceneTree::process → physics_process/process → Node notifications`

## 源码阅读顺序

1. `Node::set_process` / physics-process 开关将节点加入或移出对应处理列表；优先级用于同类处理节点排序。
2. `SceneTree::iteration`（Godot 3）或 `SceneTree::process`（Godot 4）将物理帧与普通帧处理分开调度。
3. `Node::_notification` 承接调度结果并调用 GDScript 回调；运行日志中的 delta 用来辨认两条路径，不作为严格帧率保证。

SceneTree::process 将物理帧与普通帧处理分开；节点开关决定登记，优先级参与同类节点回调顺序。Godot 4 还存在 thread group 和 internal process，本课只跟踪普通主线程节点路径。

## 最小 Godot/GDScript 实验

开启 _process 与 _physics_process，设定 process_priority，打印前几次 delta 并在达到阈值后退出。

实验文件：

- [`project.godot`](project.godot)
- [`main.tscn`](main.tscn)
- [`process_probe.gd`](process_probe.gd)

## 运行与观察

在本课目录用匹配本代的 Godot 程序运行：

```sh
godot --path .
```

**预期观察：** 预期普通帧与物理帧两类日志均出现；delta 和打印交错顺序由目标平台实际调度决定。

**动手改一处：** 给第二个节点设相反 priority，按源码预测同类回调顺序，再在运行日志核对。

## 简化与边界

实验限制为主场景普通 Node 的脚本回调，不测 worker thread、内部通知、低处理器模式或固定步补帧上限。

未在本次静态检查中启动该项目；源码事实与预期输出分开记录。

## 本课 C++ 源码摘录

课内 `src/upstream/` 复制本课对应的上游行段并标出原始行号，供逐段追踪；完整源码上下文仍以只读 engine 快照为准。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | 上游文件 | 行号 |
| --- | --- | --- |
| [node.cpp](src/upstream/scene/main/node.cpp.excerpt) | `engine/godot-4.7/scene/main/node.cpp` | 68-147, 617-637, 1025-1045, 1151-1171 |
| [scene_tree.cpp](src/upstream/scene/main/scene_tree.cpp.excerpt) | `engine/godot-4.7/scene/main/scene_tree.cpp` | 688-791 |

## 下一课

[第 17 课：ProcessMode、节点组与暂停传播](../s17_pause_modes/README.md)
