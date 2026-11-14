# 第 6 课：`SceneTree::physics_process()` 与 `process()`

**目标：** 追踪 Godot 4.7 的 SceneTree 如何在固定 tick 和普通帧分派节点回调，并在两阶段处理计时器、Tween、变换与退出。

## 本课问题

`_physics_process()` 和 `_process()` 分别在哪个 SceneTree 阶段执行？`SceneTree::_process(bool)` 如何调度 process groups？退出时如何卸载树？

## 源码调用链

源码依据：`engine/godot-4.7/`（Godot 4.7 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-4.7/` 快照根目录：

- `scene/main/scene_tree.cpp:639-671`：`physics_process()` 更新物理帧计数、发出 `physics_frame`，调用 `_process(true)`，再处理 physics Timer/Tween 和删除队列。
- `scene/main/scene_tree.cpp:688-790`：`process()` 发出 `process_frame`，调用 `_process(false)`，处理待切换场景、Timer/Tween、变换与 idle callbacks。
- `scene/main/scene_tree.cpp:1244-1315`：`_process(bool)` 按 process group 的 order/thread 设置组织节点，并逐组执行。
- `scene/main/node.cpp:99-105`、`263-279`、`4073-4074`：Node 的通知转发 `_process` / `_physics_process`，在 `_ready` 时检测并启用脚本虚方法。
- `scene/main/scene_tree.cpp:855-891`：`quit()` 记录退出码并置 `_quit`；`finalize()` 传播退出树通知并清理 timers/tweens。

调用摘要：`Main::iteration()` 的固定 tick → `SceneTree::physics_process()` → process groups 中的 physics 回调 → timer/tween 收尾；随后 `SceneTree::process()` →普通帧回调与 idle 收尾 → `_quit` 返回 OS。

## 本课源码复刻

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-4.7` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [node.cpp](src/upstream/scene/main/node.cpp) | [摘录](src/upstream/scene/main/node.cpp.excerpt) | `engine/godot-4.7/scene/main/node.cpp` | 99-105 |
| 2 | [scene_tree.cpp](src/upstream/scene/main/scene_tree.cpp) | [摘录](src/upstream/scene/main/scene_tree.cpp.excerpt) | `engine/godot-4.7/scene/main/scene_tree.cpp` | 639-671 |

## 可运行源码复刻

课程代码 [`src/source_replay.gd`](src/source_replay.gd) 按本课 C++ 函数关系实现一个小型 GDScript 模型；入口脚本会先运行它，再执行下面的真实引擎 API 实验。阅读时把模型中的状态变化逐步映射到上方的 C++ 摘录。模型只复刻本课选出的路径，不声称等同于完整 Godot 引擎。

## 最小 Godot/GDScript 实验

- `project.godot` 指定本目录 `main.tscn`。
- `tree_probe.gd` 记录首次 `_physics_process(delta)` 与 `_process(delta)` 的 delta，约 2 秒后调用 `get_tree().quit()`。
- 在本目录运行：

```sh
godot --path .
```

观察两类回调首次收到的 delta 和 quit 输出。fixed 回调与普通帧回调的先后取决于首帧调度，数值取决于 physics tick 和实际帧率。

## 简化与边界

不改 process priority、thread group、physics tick rate、pause、physics interpolation、Timer 或 Tween 设置。Godot 4.7 的 process group 调度和 `SceneTree::physics_process/process` 不外推到旧版；本课尚未运行。

## 下一课

继续阅读 [s07_object_lifetime](../s07_object_lifetime/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
