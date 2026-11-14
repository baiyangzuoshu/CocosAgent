# 第 15 课：SceneTree 生命周期通知与回调顺序

**目标：** 追踪 Node 加入/离开 SceneTree 的递归通知，并用脚本回调观察 enter、ready、exit 顺序。

## 本课问题

进入树时 parent 和 child 谁先通知？ready 是否沿同一顺序传播？移除节点时何时发生 exit？

## C++ 源码追踪

以下行号相对于仓库本地 `engine/godot-3.6/` 快照。
- `engine/godot-3.6/scene/main/node.cpp:188-203, 249-305, 342-407, 1323-1336`：摘录包含本课的关键函数实现。

调用链：`Node::add_child → _propagate_enter_tree (parent first) → child recursion → _propagate_ready (children first) → _propagate_exit_tree`

## 源码阅读顺序

1. `_propagate_enter_tree` 先设置当前节点的树状态并发 enter 通知，再递归进入子节点。
2. `_propagate_ready` 在子树准备完成后通知当前节点；用递归顺序解释 ready 与 enter 顺序相反。
3. `_propagate_exit_tree` 先递归退出子节点，再处理当前节点的退出回调和树状态清理；对照动态添加后立即移除的日志。

加入树时 Node 建立 tree/viewport 状态并向下传播进入通知；ready 在子树准备完成后传播；离树时先处理子节点再完成父节点退出。具体代码对照本版本 Node 的三个传播函数，脚本实验把子节点动态加入再移除，观察新增子树的完整回调序列。

## 最小 Godot/GDScript 实验

根脚本打印自己的 enter/ready/exit；_ready 动态挂载带 child_probe.gd 的 Node，随后立即 remove_child；孩子脚本也打印三种回调。

实验文件：

- [`project.godot`](project.godot)
- [`main.tscn`](main.tscn)
- [`child_probe.gd`](child_probe.gd)
- [`lifecycle_probe.gd`](lifecycle_probe.gd)

## 运行与观察

在本课目录用匹配本代的 Godot 程序运行：

```sh
godot --path .
```

**预期观察：** 预期看到 root enter/ready，然后 child enter/ready/exit；退出主场景时 root exit。动态挂载点不同于启动时整棵场景树的 ready 顺序。

**动手改一处：** 改为只移除 child 不退出场景，比较哪些通知出现；再将 remove_child 延后，观察退出回调所在时点。

## 简化与边界

动态挂载实验不等价于场景启动时递归 ready 的完整顺序；只观察一层子节点，不涉及 reparent 和异常退出。

未在本次静态检查中启动该项目；源码事实与预期输出分开记录。

## 本课 C++ 源码摘录

课内 `src/upstream/` 复制本课对应的上游行段并标出原始行号，供逐段追踪；完整源码上下文仍以只读 engine 快照为准。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | 上游文件 | 行号 |
| --- | --- | --- |
| [node.cpp](src/upstream/scene/main/node.cpp.excerpt) | `engine/godot-3.6/scene/main/node.cpp` | 188-203, 249-305, 342-407, 1323-1336 |

## 下一课

[第 16 课：_process、_physics_process 与优先级](../s16_process_physics_process/README.md)
