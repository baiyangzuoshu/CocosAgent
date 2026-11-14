# 第 18 课：call_deferred、删除队列与 queue_free

**目标：** 区分 call_deferred 的消息队列和 queue_free 的场景树删除队列，追踪对象什么时候退出树。

## 本课问题

call_deferred 何时调用？queue_free 是否立即析构？两条队列如何在帧边界协同？

## C++ 源码追踪

以下行号相对于仓库本地 `engine/godot-3.6/` 快照。
- `engine/godot-3.6/core/object.cpp:1777-1779`：摘录包含本课的关键函数实现。
- `engine/godot-3.6/core/message_queue.cpp:42-82, 311-405`：摘录包含本课的关键函数实现。
- `engine/godot-3.6/scene/main/node.cpp:2944-2954`：摘录包含本课的关键函数实现。
- `engine/godot-3.6/scene/main/scene_tree.cpp:1299-1347`：摘录包含本课的关键函数实现。

调用链：`Object::call_deferred → MessageQueue/CallQueue enqueue → queue flush → Node::queue_free → SceneTree::queue_delete → deferred delete list`

## 源码阅读顺序

1. `Object::call_deferred`（Godot 4 内部为 `call_deferredp`）把方法和参数放入消息队列，而不是在当前调用栈直接执行。
2. `MessageQueue::push_call*` 复制参数并保存待调调用；`flush` 取出条目后分派。对照队列如何允许执行期间继续追加消息。
3. `Node::queue_free/queue_delete` 请求 SceneTree 在安全阶段删除节点；先完成 deferred 方法，再看到退出树通知和最终释放。

call_deferred 把方法调用打包进消息队列，flush 时再分派；Node.queue_free 将节点交给 SceneTree 的删除队列，随后在安全时机释放。它们是两个阶段：被延迟调用的方法可以再请求 queue_free，退出树/销毁晚于当前同步调用。Godot 4 将队列实现称为 CallQueue。

## 最小 Godot/GDScript 实验

主脚本创建带 _exit_tree 标记的 Child，调用 child.call_deferred("_deferred_free")；该方法打印标记并 queue_free。根节点运行几帧后退出。

实验文件：

- [`project.godot`](project.godot)
- [`main.tscn`](main.tscn)
- [`deferred_child.gd`](deferred_child.gd)
- [`deferred_probe.gd`](deferred_probe.gd)

## 运行与观察

在本课目录用匹配本代的 Godot 程序运行：

```sh
godot --path .
```

**预期观察：** 预期先打印“请求已排队”，稍后打印 deferred 方法，再看到 Child 的 exit_tree 标记。运行时的帧边界以对应 Godot 版本日志确认为准。

**动手改一处：** 将 call_deferred 改为直接调用 _deferred_free，比较日志先后；恢复后将 queue_free 改为 free，注意语义变化。

## 简化与边界

不覆盖树正在退出、线程组调用、对象销毁中的递归队列和消息队列溢出；只观察单个节点的一次延迟释放。

未在本次静态检查中启动该项目；源码事实与预期输出分开记录。

## 本课 C++ 源码摘录

课内 `src/upstream/` 复制本课对应的上游行段并标出原始行号，供逐段追踪；完整源码上下文仍以只读 engine 快照为准。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | 上游文件 | 行号 |
| --- | --- | --- |
| [object.cpp](src/upstream/core/object.cpp.excerpt) | `engine/godot-3.6/core/object.cpp` | 1777-1779 |
| [message_queue.cpp](src/upstream/core/message_queue.cpp.excerpt) | `engine/godot-3.6/core/message_queue.cpp` | 42-82, 311-405 |
| [node.cpp](src/upstream/scene/main/node.cpp.excerpt) | `engine/godot-3.6/scene/main/node.cpp` | 2944-2954 |
| [scene_tree.cpp](src/upstream/scene/main/scene_tree.cpp.excerpt) | `engine/godot-3.6/scene/main/scene_tree.cpp` | 1299-1347 |

## 下一课

[第 19 课：Node2D 变换与 CanvasItem 更新](../s19_node2d_canvasitem/README.md)
