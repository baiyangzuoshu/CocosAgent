# 第 6 课：`SceneTree::physics_process()` 与 `process()`

**目标：** 追踪 Godot 4.7 的 SceneTree 如何在固定 tick 和普通帧分派节点回调，并在两阶段处理计时器、Tween、变换与退出。

## 本课增量

把输入 handled 状态、节点 fixed/idle 资格、暂停处理和延迟释放队列纳入 SceneTree 更新流程。

**本课要回答：** `_physics_process()` 和 `_process()` 分别在哪个 SceneTree 阶段执行？`SceneTree::_process(bool)` 如何调度 process groups？退出时如何卸载树？

## C++ 源码追踪

源码依据：`engine/godot-4.7/`（Godot 4.7 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-4.7/` 快照根目录：

- `scene/main/scene_tree.cpp:639-671`：`physics_process()` 更新物理帧计数、发出 `physics_frame`，调用 `_process(true)`，再处理 physics Timer/Tween 和删除队列。
- `scene/main/scene_tree.cpp:688-790`：`process()` 发出 `process_frame`，调用 `_process(false)`，处理待切换场景、Timer/Tween、变换与 idle callbacks。
- `scene/main/scene_tree.cpp:1244-1315`：`_process(bool)` 按 process group 的 order/thread 设置组织节点，并逐组执行。
- `scene/main/node.cpp:99-105`、`263-279`、`4073-4074`：Node 的通知转发 `_process` / `_physics_process`，在 `_ready` 时检测并启用脚本虚方法。
- `scene/main/scene_tree.cpp:855-891`：`quit()` 记录退出码并置 `_quit`；`finalize()` 传播退出树通知并清理 timers/tweens。

调用摘要：`Main::iteration()` 的固定 tick → `SceneTree::physics_process()` → process groups 中的 physics 回调 → timer/tween 收尾；随后 `SceneTree::process()` →普通帧回调与 idle 收尾 → `_quit` 返回 OS。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [node.cpp](src/upstream/scene/main/node.cpp) | [99-105](src/upstream/scene/main/node.cpp.excerpt) | engine/godot-4.7/scene/main/node.cpp |
| 2 | [scene_tree.cpp](src/upstream/scene/main/scene_tree.cpp) | [639-671 ; 688-790 ; 855-891 ; 1244-1315](src/upstream/scene/main/scene_tree.cpp.excerpt) | engine/godot-4.7/scene/main/scene_tree.cpp |

## GDScript 源码复刻

S06 Godot 4.7: SceneTree process groups divide physics and idle callbacks.

source_replay.gd 按本课指定快照复刻控制流与状态传递，模型中的状态字段、函数入口和 API 名称对应本代 C++ 路径。根目录实验脚本先运行模型，再调用对应版本的 Godot API。

| GDScript 函数 | 复刻步骤 |
| --- | --- |
| _scene_tree_physics() | 分派本阶段信号/通知并执行阶段收尾 |
| _scene_tree_process() | 分派本阶段信号/通知并执行阶段收尾 |
| _process_groups() | 按 process group 顺序筛选节点并派发回调 |
| _sort_groups() | 按 process group 顺序筛选节点并派发回调 |

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
