# 第 6 课：`SceneTree::iteration()` 与 idle 更新

**目标：** 追踪 Godot 2.1 `SceneTree` 如何将固定步和 idle 步分发为 Node 通知，并在两阶段处理树内更新和删除队列。

## 本课问题

fixed 与 idle 阶段分别发送什么通知？delta 如何保存给 Node 查询？`SceneTree.quit()` 的标记如何传回平台？

## C++ 源码追踪

以下路径相对于 `engine/godot-2.1/` 快照根目录：

- `scene/main/scene_main_loop.cpp:473-495`：`iteration(p_time)` 更新固定帧计数，保存 `fixed_process_time`，发出 `fixed_frame` 并向 `fixed_process` 组发送 `NOTIFICATION_FIXED_PROCESS`。
- `scene/main/scene_main_loop.cpp:497-533`：`idle(p_time)` 保存 idle delta、发出 `idle_frame`，向 `idle_process` 组发送 `NOTIFICATION_PROCESS`，更新 Viewport 并清理删除队列。
- `scene/main/node.cpp:52-73`、`2179-2186`：Node 通知把 delta 交给 `_process` / `_fixed_process`，并注册对应脚本回调。
- `scene/main/scene_main_loop.cpp:535-553`：`quit()` 只设置 `_quit`；两个迭代阶段返回该状态，`finish()` 清理队列并卸下 root。

调用摘要：`Main::iteration()` 进入 SceneTree fixed 更新 → 物理服务器由外层主循环推进 → SceneTree idle 更新 → Node 收到对应通知 → quit 状态返回 OS 循环。

## 最小实验

- `engine.cfg` 选择 format 1 场景 `main.tscn`。
- `tree_probe.gd` 分别记录首次 `_fixed_process(delta)` 和 `_process(delta)` 的 delta；约 2 秒后调用 `get_tree().quit()`。
- 在本目录运行：

```sh
godot -path .
```

观察两阶段回调和各自收到的 delta，最后进程退出。回调的先后取决于首帧时钟状态，数值受物理 tick 和运行帧率影响。

## 简化与边界

不处理输入路由、暂停组、窗口变化、线程化资源更新和 PhysicsServer 同步细节。Godot 2.1 的 `SceneTree::iteration/idle`、通知组和 `ObjectTypeDB` 以本快照为准；本课尚未运行。

## 本课 C++ 源码摘录

课内摘录保留对应 Godot 源码行段正文，并在段首标出原始行号；完整上下文以只读的 engine 快照为准。摘录用于追踪，不是独立编译单元。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | Godot 源文件 | 上游行段 |
| --- | --- | --- |
| [node.cpp](src/upstream/scene/main/node.cpp.excerpt) | godot-2.1/scene/main/node.cpp | 52-73 |
| [scene_main_loop.cpp](src/upstream/scene/main/scene_main_loop.cpp.excerpt) | godot-2.1/scene/main/scene_main_loop.cpp | 473-495, 497-533, 535-553 |
