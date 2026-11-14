# 第 17 课：节点组分派与暂停模式

**目标：** 把 Node 入组、SceneTree group 调用和暂停策略放在同一条控制路径中。

## 本课问题

节点加入组后由谁保存成员？call_group 默认同步还是延迟？暂停后哪些节点还允许处理？

## C++ 源码追踪

以下行号相对于仓库本地 `engine/godot-3.6/` 快照。
- `engine/godot-3.6/scene/main/node.cpp:526-553, 1854-1872`：摘录包含本课的关键函数实现。
- `engine/godot-3.6/scene/main/scene_tree.cpp:422-424, 1047-1058`：摘录包含本课的关键函数实现。

调用链：`Node::add_to_group → SceneTree group map → SceneTree::call_group → target Object::call; SceneTree::set_pause + Node::set_pause_mode`

## 源码阅读顺序

1. `Node::add_to_group` 登记组成员，SceneTree 持有组索引，不改变节点父子树。
2. `SceneTree::call_group` 取出组内节点并进行同步方法分派；需要延迟时应走带 flags 的另一条路径。
3. `SceneTree::set_pause` 与 `Node::set_pause_mode` 一起决定节点是否接收处理；实验把配置打印出来，不把瞬时设 paused 当作运行期暂停验证。

Group 是 SceneTree 管理的索引，不是 Node 的子树关系；call_group 按组内节点列表分派方法。暂停策略从 SceneTree 的 pause 状态和节点 pause/process mode 共同计算。Godot 4 将 pause_mode 改为 process_mode，旧版本属性不外推。

## 最小 Godot/GDScript 实验

根节点加入 lesson_targets 组，call_group 调用成员方法；切换 SceneTree.paused 并打印 Node.pause_mode。

实验文件：

- [`project.godot`](project.godot)
- [`main.tscn`](main.tscn)
- [`group_pause_probe.gd`](group_pause_probe.gd)

## 运行与观察

在本课目录用匹配本代的 Godot 程序运行：

```sh
godot --path .
```

**预期观察：** 预期 group 回调同步打印一次。暂停影响之后的树处理，回调不会截断当前同步调用栈。

**动手改一处：** 把组名换成不存在的组，预测是否有回调；再将一个第二节点加入同组观察成员分派。

## 简化与边界

实验只执行一次同步组调用并设置暂停状态，不用定时器测量暂停期间回调频率；group 调用的延迟 flags 不在此实验覆盖。

未在本次静态检查中启动该项目；源码事实与预期输出分开记录。

## 本课 C++ 源码摘录

课内 `src/upstream/` 复制本课对应的上游行段并标出原始行号，供逐段追踪；完整源码上下文仍以只读 engine 快照为准。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | 上游文件 | 行号 |
| --- | --- | --- |
| [node.cpp](src/upstream/scene/main/node.cpp.excerpt) | `engine/godot-3.6/scene/main/node.cpp` | 526-553, 1854-1872 |
| [scene_tree.cpp](src/upstream/scene/main/scene_tree.cpp.excerpt) | `engine/godot-3.6/scene/main/scene_tree.cpp` | 422-424, 1047-1058 |

## 下一课

[第 18 课：call_deferred、删除队列与 queue_free](../s18_deferred_calls_free/README.md)
