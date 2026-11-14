# 本课源码副本与 GDScript 复刻模型

源码依据：只读快照 `engine/godot-3.6/`。`upstream/` 按上游路径保存本课涉及文件的完整副本，`.excerpt` 仅包含带原始行号的重点区段。完整副本须与快照逐字节一致；摘录用于定位，不能替代完整文件。

阅读顺序：先从课程 README 的 `Main::iteration()` 调用点进入，再跟踪 `MainTimerSync::advance()`、`advance_checked()` 和 `advance_core()`；最后阅读 MainLoop/Node 调度与服务器同步。对照表列出每份文件的源快照与摘录范围。

| 阅读顺序 | 完整上游副本 | 函数/行号摘录 | 源码快照路径 |
| --- | --- | --- | --- |
| 1 | [main.cpp](upstream/main/main.cpp) | [2304-2359 ; 2363-2410 ; 2420-2453 ; 2472](upstream/main/main.cpp.excerpt) | engine/godot-3.6/main/main.cpp |
| 2 | [main_timer_sync.cpp](upstream/main/main_timer_sync.cpp) | [322-403 ; 405-479 ; 481-522](upstream/main/main_timer_sync.cpp.excerpt) | engine/godot-3.6/main/main_timer_sync.cpp |
| 3 | [main_timer_sync.h](upstream/main/main_timer_sync.h) | [39-44 ; 111-162](upstream/main/main_timer_sync.h.excerpt) | engine/godot-3.6/main/main_timer_sync.h |
| 4 | [node.cpp](upstream/scene/main/node.cpp) | [50-70 ; 3275-3276](upstream/scene/main/node.cpp.excerpt) | engine/godot-3.6/scene/main/node.cpp |

## GDScript 源码教学复刻

[source_replay.gd](source_replay.gd) 复现一帧时间进入 accumulator、得到物理步数、应用本代上限并记录剩余时间/插值比例，再按源码顺序记录物理、idle/process 与绘制阶段。模型明确省略时间平滑和历史校正，细节见课程 README。

## 证据边界

完整源码副本来自本地静态快照；GDScript 文件是简化算法模型；`frame_probe.gd` 的回调计数需要对应版本的 Godot 实际运行后才能记作运行时证据。本课没有运行实验。
