# 第 6 课：`SceneTree::iteration()` 与 idle 更新

**目标：** 追踪 Godot 3.6 fixed/idle 两阶段如何向节点发送处理通知，并在更新后处理 Tween、变换、删除队列和 Viewport。

## 本课问题

固定帧和 idle 帧分别在哪个组上发送通知？SceneTree 信号与脚本回调的顺序如何安排？退出标记如何返回平台？

## 源码调用链

源码依据：`engine/godot-3.6/`（Godot 3.6 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-3.6/` 快照根目录：

- `scene/main/scene_tree.cpp:578-609`：`iteration()` 更新物理帧计数，发出 `physics_frame`，发送 internal/physics process 通知，更新 physics Tween 和变换，最后清理删除队列。
- `scene/main/scene_tree.cpp:621-733`：`idle()` 发出 `idle_frame`，发送 idle process 通知，处理 Viewport、SceneTreeTimer、Tween 和删除队列，再调用 `VisualServer::pre_draw()`。
- `scene/main/node.cpp:50-70`、`159-169`、`3275-3276`：Node 将脚本 `_process` / `_physics_process` 接入两类通知；Godot 3 在 `_ready` 阶段检查脚本方法并启用对应处理。
- `scene/main/scene_tree.cpp:762-805`：`quit()` 设置 `_quit` 和退出码；`finish()` 清理树并传播退出树通知。

调用摘要：fixed `SceneTree::iteration()` → `physics_frame` 与 physics 通知 → idle `SceneTree::idle()` → `idle_frame` 与 process 通知 → Tween/Timer/变换收尾 → quit 状态传回主循环。

## 本课源码复刻

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-3.6` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [node.cpp](src/upstream/scene/main/node.cpp) | [摘录](src/upstream/scene/main/node.cpp.excerpt) | `engine/godot-3.6/scene/main/node.cpp` | 50-70 |
| 2 | [scene_tree.cpp](src/upstream/scene/main/scene_tree.cpp) | [摘录](src/upstream/scene/main/scene_tree.cpp.excerpt) | `engine/godot-3.6/scene/main/scene_tree.cpp` | 578-609, 621-733 |

## 可运行源码复刻

课程代码 [`src/source_replay.gd`](src/source_replay.gd) 按本课 C++ 函数关系实现一个小型 GDScript 模型；入口脚本会先运行它，再执行下面的真实引擎 API 实验。阅读时把模型中的状态变化逐步映射到上方的 C++ 摘录。模型只复刻本课选出的路径，不声称等同于完整 Godot 引擎。

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
