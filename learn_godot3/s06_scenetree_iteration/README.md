# 第 6 课：`SceneTree::iteration()` 与 idle 更新

**目标：** 追踪 Godot 3.6 fixed/idle 两阶段如何向节点发送处理通知，并在更新后处理 Tween、变换、删除队列和 Viewport。

## 本课增量

把输入 handled 状态、节点 fixed/idle 资格、暂停处理和延迟释放队列纳入 SceneTree 更新流程。

**本课要回答：** 固定帧和 idle 帧分别在哪个组上发送通知？SceneTree 信号与脚本回调的顺序如何安排？退出标记如何返回平台？

## C++ 源码追踪

源码依据：`engine/godot-3.6/`（Godot 3.6 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-3.6/` 快照根目录：

- `scene/main/scene_tree.cpp:578-609`：`iteration()` 更新物理帧计数，发出 `physics_frame`，发送 internal/physics process 通知，更新 physics Tween 和变换，最后清理删除队列。
- `scene/main/scene_tree.cpp:621-733`：`idle()` 发出 `idle_frame`，发送 idle process 通知，处理 Viewport、SceneTreeTimer、Tween 和删除队列，再调用 `VisualServer::pre_draw()`。
- `scene/main/node.cpp:50-70`、`159-169`、`3275-3276`：Node 将脚本 `_process` / `_physics_process` 接入两类通知；Godot 3 在 `_ready` 阶段检查脚本方法并启用对应处理。
- `scene/main/scene_tree.cpp:762-805`：`quit()` 设置 `_quit` 和退出码；`finish()` 清理树并传播退出树通知。

调用摘要：fixed `SceneTree::iteration()` → `physics_frame` 与 physics 通知 → idle `SceneTree::idle()` → `idle_frame` 与 process 通知 → Tween/Timer/变换收尾 → quit 状态传回主循环。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [node.cpp](src/upstream/scene/main/node.cpp) | [50-70](src/upstream/scene/main/node.cpp.excerpt) | engine/godot-3.6/scene/main/node.cpp |
| 2 | [scene_tree.cpp](src/upstream/scene/main/scene_tree.cpp) | [578-609 ; 621-733 ; 762-805](src/upstream/scene/main/scene_tree.cpp.excerpt) | engine/godot-3.6/scene/main/scene_tree.cpp |

## GDScript 源码复刻

`src/source_replay.gd` 按本课列出的 C++ 入口重建关键数据结构、条件分支和状态更新。它是可逐步阅读的教学移植，不是完整引擎替身；模型函数表会标明直接对应的源码行为和仅用于组织输入/输出的脚手架。平台、线程、对象分配和服务器副作用仍由真实引擎处理。

| 模型函数 | C++ 源码对照或脚手架性质 | 复现的状态与分支 |
| --- | --- | --- |
| `_physics_frame()` | `SceneTree::iteration / physics_frame` | 发送 physics_frame 与内部/普通物理通知。 |
| `_idle_frame()` | `SceneTree::idle / idle_frame` | 发送 idle_frame 与内部/普通 idle 通知。 |
| `_dispatch()` | `SceneTree notification dispatch → Node::_notification` | 依照处理开关向节点发送指定通知。 |

## 最小 Godot/GDScript 实验

- `project.godot` 指向当前目录 `main.tscn`。
- `tree_probe.gd` 记录首次 `_physics_process(delta)` 与 `_process(delta)` 的 delta，约 2 秒后调用 `get_tree().quit()`。
- 在本目录运行：

```sh
godot --path .
```

观察固定阶段的 `_physics_process` 与 idle 阶段的 `_process` 回调及 delta，再观察进程结束。两类回调的首个输出顺序及数值会随时钟和帧率变化。

## 简化与边界

不更改 pause、physics tick、Tween、Timer 或 physics interpolation 设置，不模拟输入事件和多人轮询。这里只依据 Godot 3.6 SceneTree 与 Node 源码；本课未运行。

## 下一课

继续阅读 [s07_object_lifetime](../s07_object_lifetime/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
