# 第 17 课：节点组调用、暂停与 pause mode

**目标：** 把 Node 入组、SceneTree group 调用和暂停策略放在同一条控制路径中。

## 本课问题

节点加入组后由谁保存成员？call_group 默认同步还是延迟？暂停后哪些节点还允许处理？

## C++ 源码追踪

以下行号相对于仓库本地 `engine/godot-1.1/` 快照。
- `engine/godot-1.1/scene/main/node.cpp:336-362, 1058-1074`：摘录包含本课的关键函数实现。
- `engine/godot-1.1/scene/main/scene_main_loop.cpp:140-220, 627-636`：摘录包含本课的关键函数实现。

调用链：`Node::add_to_group → SceneTree group map → SceneTree::call_group(flags, group, method) → target call; set_pause + Node::set_pause_mode`

## 源码阅读顺序

1. `Node::add_to_group` 记录节点的组名；节点入树时由 SceneTree 建立可分派的组成员表。
2. `SceneTree::call_group` 按组名遍历成员并调用方法；1/2 的第一个参数是调用 flags，实验传 `0` 做同步调用。
3. `SceneTree::set_pause` 切换整树暂停状态，`Node::set_pause_mode` 决定节点是否继承或忽略暂停。

Group 是 SceneTree 管理的索引，不是 Node 的子树关系；call_group 按组内节点列表分派方法。暂停策略从 SceneTree 的 pause 状态和节点 pause/process mode 共同计算。Godot 4 将 pause_mode 改为 process_mode，旧版本属性不外推。

## 最小 Godot/GDScript 实验

根节点加入 lesson_targets 组并通过本代 call_group(flags,group,method) 调用自己的回调；切换 SceneTree.pause 并打印当前 pause mode。

实验文件：

- [`engine.cfg`](engine.cfg)
- [`main.xml`](main.xml)
- [`group_pause_probe.gd`](group_pause_probe.gd)

## 运行与观察

在本课目录用匹配本代的 Godot 程序运行：

```sh
godot -path .
```

**预期观察：** 预期 group 回调同步打印一次。pause 只影响后续处理，不会中断当前 GDScript 函数。

**动手改一处：** 把组名换成不存在的组，预测是否有回调；再将一个第二节点加入同组观察成员分派。

## 简化与边界

实验只执行一次同步组调用并设置暂停状态，不用定时器测量暂停期间回调频率；group 调用的延迟 flags 不在此实验覆盖。

未在本次静态检查中启动该项目；源码事实与预期输出分开记录。

## 本课 C++ 源码摘录

课内 `src/upstream/` 复制本课对应的上游行段并标出原始行号，供逐段追踪；完整源码上下文仍以只读 engine 快照为准。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | 上游文件 | 行号 |
| --- | --- | --- |
| [node.cpp](src/upstream/scene/main/node.cpp.excerpt) | `engine/godot-1.1/scene/main/node.cpp` | 336-362, 1058-1074 |
| [scene_main_loop.cpp](src/upstream/scene/main/scene_main_loop.cpp.excerpt) | `engine/godot-1.1/scene/main/scene_main_loop.cpp` | 140-220, 627-636 |

## 下一课

[第 18 课：MessageQueue 延迟调用与 queue_free](../s18_deferred_free/README.md)
