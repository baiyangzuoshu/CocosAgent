# 第 16 课：SceneTree idle/fixed 与处理通知

**目标：** 从 Node 的 process/fixed-process 开关追到 SceneTree 每帧的 idle 与 fixed 通知分派。

## 本课问题

set_process 与 set_fixed_process 各加入哪条处理路径？一次 SceneTree iteration 可能产生多少 fixed 回调？

## C++ 源码追踪

以下行号相对于仓库本地 `engine/godot-2.1/` 快照。
- `engine/godot-2.1/scene/main/node.cpp:42-137, 343-357, 434-448`：摘录包含本课的关键函数实现。
- `engine/godot-2.1/scene/main/scene_main_loop.cpp:473-495, 497-533`：摘录包含本课的关键函数实现。

调用链：`Node::set_process / set_fixed_process → process queues → SceneTree::iteration → fixed notifications + idle notification`

## 源码阅读顺序

1. `Node::set_process` / `set_fixed_process` 切换节点的 idle/fixed 处理资格；`Node::_notification` 将处理通知转给脚本回调。
2. `SceneTree::iteration` 使用时间累积安排 fixed step，必要时一帧内执行多个 fixed 通知，再进入 idle 更新。
3. `SceneTree::idle` 执行当前帧的 idle 通知和相关树更新；两种 delta 代表不同调度时钟。

Node 开关决定是否进入相应处理列表；SceneTree::iteration 按累计时间可能执行多个 fixed step，再调用 idle 更新。Node::_notification 将内部处理通知传给脚本回调。Godot 1/2 使用本代 fixed_process 名称，不能替换成新版本 physics_process。

## 最小 Godot/GDScript 实验

脚本开启 set_process(true) 与 set_fixed_process(true)，分别计数 _process(delta) 和 _fixed_process(delta)，达到几次回调后退出。

实验文件：

- [`engine.cfg`](engine.cfg)
- [`main.tscn`](main.tscn)
- [`process_probe.gd`](process_probe.gd)

## 运行与观察

在本课目录用匹配本代的 Godot 程序运行：

```sh
godot -path .
```

**预期观察：** 预期 idle 与 fixed 日志都出现；两种 delta 和次数受机器帧率与固定步长影响。

**动手改一处：** 关闭 fixed process 开关，预测 _fixed_process 是否继续出现；恢复后调整统计阈值。

## 简化与边界

实验限制为主场景普通 Node 的脚本回调，不测 worker thread、内部通知、低处理器模式或固定步补帧上限。

未在本次静态检查中启动该项目；源码事实与预期输出分开记录。

## 本课 C++ 源码摘录

课内 `src/upstream/` 复制本课对应的上游行段并标出原始行号，供逐段追踪；完整源码上下文仍以只读 engine 快照为准。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | 上游文件 | 行号 |
| --- | --- | --- |
| [node.cpp](src/upstream/scene/main/node.cpp.excerpt) | `engine/godot-2.1/scene/main/node.cpp` | 42-137, 343-357, 434-448 |
| [scene_main_loop.cpp](src/upstream/scene/main/scene_main_loop.cpp.excerpt) | `engine/godot-2.1/scene/main/scene_main_loop.cpp` | 473-495, 497-533 |

## 下一课

[第 17 课：节点组分派、暂停与 pause mode](../s17_groups_pause/README.md)
