# 第 6 课：`SceneTree::iteration()` 与 idle 更新

**目标：** 追踪 Godot 2.1 `SceneTree` 如何将固定步和 idle 步分发为 Node 通知，并在两阶段处理树内更新和删除队列。

## 本课增量

把输入 handled 状态、节点 fixed/idle 资格、暂停处理和延迟释放队列纳入 SceneTree 更新流程。

**本课要回答：** fixed 与 idle 阶段分别发送什么通知？delta 如何保存给 Node 查询？`SceneTree.quit()` 的标记如何传回平台？

## C++ 源码追踪

源码依据：`engine/godot-2.1/`（Godot 2.1 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-2.1/` 快照根目录：

- `scene/main/scene_main_loop.cpp:473-495`：`iteration(p_time)` 更新固定帧计数，保存 `fixed_process_time`，发出 `fixed_frame` 并向 `fixed_process` 组发送 `NOTIFICATION_FIXED_PROCESS`。
- `scene/main/scene_main_loop.cpp:497-533`：`idle(p_time)` 保存 idle delta、发出 `idle_frame`，向 `idle_process` 组发送 `NOTIFICATION_PROCESS`，更新 Viewport 并清理删除队列。
- `scene/main/node.cpp:52-73`、`2179-2186`：Node 通知把 delta 交给 `_process` / `_fixed_process`，并注册对应脚本回调。
- `scene/main/scene_main_loop.cpp:535-553`：`quit()` 只设置 `_quit`；两个迭代阶段返回该状态，`finish()` 清理队列并卸下 root。

调用摘要：`Main::iteration()` 进入 SceneTree fixed 更新 → 物理服务器由外层主循环推进 → SceneTree idle 更新 → Node 收到对应通知 → quit 状态返回 OS 循环。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [node.cpp](src/upstream/scene/main/node.cpp) | [52-73](src/upstream/scene/main/node.cpp.excerpt) | engine/godot-2.1/scene/main/node.cpp |
| 2 | [scene_main_loop.cpp](src/upstream/scene/main/scene_main_loop.cpp) | [473-495 ; 497-533 ; 535-553](src/upstream/scene/main/scene_main_loop.cpp.excerpt) | engine/godot-2.1/scene/main/scene_main_loop.cpp |

## GDScript 源码复刻

S06 Godot 2.1: fixed and idle phases dispatch different process groups.

source_replay.gd 按本课指定快照复刻控制流与状态传递，模型中的状态字段、函数入口和 API 名称对应本代 C++ 路径。根目录实验脚本先运行模型，再调用对应版本的 Godot API。

| GDScript 函数 | 复刻步骤 |
| --- | --- |
| _emit_fixed_frame() | 分派本阶段信号/通知并执行阶段收尾 |
| _emit_idle_frame() | 分派本阶段信号/通知并执行阶段收尾 |
| _flush_delete_queue() | 更新本课状态并向后续步骤传递结果 |

## 最小 Godot/GDScript 实验

- `engine.cfg` 选择 format 1 场景 `main.tscn`。
- `tree_probe.gd` 分别记录首次 `_fixed_process(delta)` 和 `_process(delta)` 的 delta；约 2 秒后调用 `get_tree().quit()`。
- 在本目录运行：

```sh
godot -path .
```

观察两阶段回调和各自收到的 delta，最后进程退出。回调的先后取决于首帧时钟状态，数值受物理 tick 和运行帧率影响。

## 简化与边界

不处理输入路由、暂停组、窗口变化、线程化资源更新和 PhysicsServer 同步细节。Godot 2.1 的 `SceneTree::iteration/idle`、通知组和 `ObjectTypeDB` 以本快照为准；本课尚未运行。

## 下一课

继续阅读 [s07_object_lifetime](../s07_object_lifetime/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
