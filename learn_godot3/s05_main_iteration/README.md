# 第 5 课：`Main::iteration()` 的固定物理步与帧提交

**目标：** 追踪 Godot 3.6 如何把 OS 时间差变成固定物理更新次数和每帧 delta，再调用脚本回调并提交服务器绘制。

## 本课增量

把定时器的累积状态、物理步数上限、固定循环、每帧回调和渲染服务器提交连成一条可检查的调用链。

**本课要回答：** 每帧经过的时间如何换算成零次或多次物理更新？引擎如何限制物理步数并留下插值余量？物理循环和 process/idle、绘制的先后关系是什么？

## C++ 源码追踪

源码依据：`engine/godot-3.6/` 本地快照。以下路径相对于该快照根目录，行号对应课程副本中的原始源码：

- `main/main.cpp:2304-2359, 2363-2410, 2420-2453, 2472`：采样帧时间并调用 `MainTimerSync::advance()`；在非 fixed-FPS 模式下把单帧物理步数限制为 8，并据此削减传给 idle 的 step。
- `main/main_timer_sync.cpp:293-320, 322-403, 405-479, 481-522`：MainTimerSync::advance() 采样经过平滑的 OS 时间；advance_checked() 补偿 time_deficit 并校正 idle_step；advance_core() 累积 time_accum，根据过去 12 帧步数历史选择 physics_steps，再返回余量与 interpolation_fraction。
- `main/main_timer_sync.h:39-44, 112-163`：查看 `MainFrameTime` 字段、`time_accum/time_deficit`、12 帧 physics history 与 `advance()` 接口。
- `scene/main/node.cpp:50-70, 3275-3276`：Node 把 `_process` / `_physics_process` 脚本回调接入本代处理队列。

调用摘要：OS 时间 → MainTimerSync 平滑并校正 idle step → physics accumulator/history → 8 步上限 → 固定循环 → idle → VisualServer sync/draw。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [2304-2359 ; 2363-2410 ; 2420-2453 ; 2472](src/upstream/main/main.cpp.excerpt) | engine/godot-3.6/main/main.cpp |
| 2 | [main_timer_sync.cpp](src/upstream/main/main_timer_sync.cpp) | [293-320 ; 322-403 ; 405-479 ; 481-522](src/upstream/main/main_timer_sync.cpp.excerpt) | engine/godot-3.6/main/main_timer_sync.cpp |
| 3 | [main_timer_sync.h](src/upstream/main/main_timer_sync.h) | [39-44 ; 112-163](src/upstream/main/main_timer_sync.h.excerpt) | engine/godot-3.6/main/main_timer_sync.h |
| 4 | [node.cpp](src/upstream/scene/main/node.cpp) | [50-70 ; 3275-3276](src/upstream/scene/main/node.cpp.excerpt) | engine/godot-3.6/scene/main/node.cpp |

## GDScript 源码复刻

`src/source_replay.gd` 按本课列出的 C++ 入口重建关键数据结构、条件分支和状态更新。它是可逐步阅读的教学移植，不是完整引擎替身；模型函数表会标明直接对应的源码行为和仅用于组织输入/输出的脚手架。平台、线程、对象分配和服务器副作用仍由真实引擎处理。

| 模型函数 | C++ 源码对照或脚手架性质 | 复现的状态与分支 |
| --- | --- | --- |
| `_new_clock()`、`_advance_core()` | `MainTimerSync` 构造函数与 `advance_core` | 初始化 12 项典型步历史，重现步数上下界、jitter 窗口和选中步数后的累加器更新。 |
| `_get_average_physics_steps()`、`_clamp_value()` | `get_average_physics_steps`、`MainFrameTime::clamp_idle` | 计算历史上兼容的平均步数区间，并作为 checked 阶段的限幅输入。 |
| `_advance_checked()` | `MainTimerSync::advance_checked` | 按顺序应用平均区间、jitter 区间、累加器区间和最小 idle delta，再回写 `time_accum`、`time_deficit` 与插值比例。 |
| `_apply_frame_cap()` | `Main::iteration max_physics_steps_per_frame` | 按上限削减 tick 数并修正 idle delta。 |
| `_physics_tick()` | `MainLoop::iteration / PhysicsServer::step` | 把固定 tick 交给 MainLoop/PhysicsServer 并记录收尾。 |
| `_idle_draw()` | `MainLoop::idle / VisualServer sync and draw` | 记录一次 idle 及随后绘制同步的先后。 |

## 最小 Godot/GDScript 实验

- `project.godot` 指定本目录的 `main.tscn`。
- `frame_probe.gd` 计数 `_process` 与 `_physics_process`，累计约一秒后打印并退出。

在本目录运行：

```sh
godot --path .
```

观察 idle 和 physics 回调计数。physics 次数接近项目物理 tick 配置，process 次数随实际帧率变化；环境、帧率限制和卡顿会改变数字。脚本只观察公开回调，不测量服务器或 GPU 工作。

## 简化与边界

模型已经移植 `advance_core` 的 12 项典型步历史、`advance_checked` 的三段限幅与 deficit 回写，以及 `Main::iteration` 的 8 步上限。它把 OS tick、delta smoother、Engine 参数和服务器调用当作确定性输入/事件，不复刻 profiler、平台同步策略和后台服务器工作；Godot 3.6 项目尚未运行。

## 下一课

继续阅读 [s06_scenetree_iteration](../s06_scenetree_iteration/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
