# 第 17 课：ProcessMode、节点组与暂停传播

**目标：** 把 Node 入组、SceneTree group 调用和暂停策略放在同一条控制路径中。

## 本课问题

节点加入组后由谁保存成员？call_group 默认同步还是延迟？暂停后哪些节点还允许处理？

## C++ 源码追踪

以下行号相对于仓库本地 `engine/godot-4.7/` 快照。
- `engine/godot-4.7/scene/main/node.cpp:669-725, 2458-2480`：摘录包含本课的关键函数实现。
- `engine/godot-4.7/scene/main/scene_tree.cpp:361-452, 1126-1145`：摘录包含本课的关键函数实现。

调用链：`Node::add_to_group → SceneTree group map → call_group_flagsp → target Node::callp; set_pause + Node::set_process_mode`

## 源码阅读顺序

1. `Node::add_to_group` 登记组成员，SceneTree 的 group map 与节点父子关系相互独立。
2. `SceneTree::call_group_flagsp` 处理分派标志、组成员和方法调用；常用 `call_group` 模板最终进入该入口。
3. `SceneTree::set_pause` / `Node::set_process_mode` 共同影响节点处理资格；Godot 4 使用 process_mode 替代旧 pause_mode。

Group 是 SceneTree 管理的索引，不是 Node 的子树关系；call_group 按组内节点列表分派方法。暂停策略从 SceneTree 的 pause 状态和节点 pause/process mode 共同计算。Godot 4 将 pause_mode 改为 process_mode，旧版本属性不外推。

## 最小 Godot/GDScript 实验

根节点加入 lesson_targets 组并调用 call_group；打印 PROCESS_MODE_ALWAYS 和继承模式节点在暂停前后的配置差别。

实验文件：

- [`project.godot`](project.godot)
- [`main.tscn`](main.tscn)
- [`group_pause_probe.gd`](group_pause_probe.gd)

## 运行与观察

在本课目录用匹配本代的 Godot 程序运行：

```sh
godot --path .
```

**预期观察：** 预期默认 group call 立即执行。模式值只说明处理资格，是否回调需在实际暂停期间运行确认。

**动手改一处：** 把组名换成不存在的组，预测是否有回调；再将一个第二节点加入同组观察成员分派。

## 简化与边界

实验只执行一次同步组调用并设置暂停状态，不用定时器测量暂停期间回调频率；group 调用的延迟 flags 不在此实验覆盖。

未在本次静态检查中启动该项目；源码事实与预期输出分开记录。

## 本课 C++ 源码摘录

课内 `src/upstream/` 复制本课对应的上游行段并标出原始行号，供逐段追踪；完整源码上下文仍以只读 engine 快照为准。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | 上游文件 | 行号 |
| --- | --- | --- |
| [node.cpp](src/upstream/scene/main/node.cpp.excerpt) | `engine/godot-4.7/scene/main/node.cpp` | 669-725, 2458-2480 |
| [scene_tree.cpp](src/upstream/scene/main/scene_tree.cpp.excerpt) | `engine/godot-4.7/scene/main/scene_tree.cpp` | 361-452, 1126-1145 |

## 下一课

[第 18 课：CallQueue、call_deferred 与 queue_free](../s18_deferred_calls_free/README.md)
