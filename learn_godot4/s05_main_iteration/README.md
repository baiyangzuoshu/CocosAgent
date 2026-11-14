# 第 5 课：`Main::iteration()` 的固定物理步与帧提交

**目标：** 追踪 Godot 4.7 如何把 OS 时间差变成固定物理更新次数和每帧 delta，再调用脚本回调并提交服务器绘制。

## 本课增量

把定时器的累积状态、物理步数上限、固定循环、每帧回调和渲染服务器提交连成一条可检查的调用链。

**本课要回答：** 每帧经过的时间如何换算成零次或多次物理更新？引擎如何限制物理步数并留下插值余量？物理循环和 process/idle、绘制的先后关系是什么？

## C++ 源码追踪

源码依据：`engine/godot-4.7/` 本地快照。以下路径相对于该快照根目录，行号对应课程副本中的原始源码：

- `main/main.cpp:4921-4959, 4970-5053, 5062-5097, 5112`：读取 `physics_ticks_per_second`、physics step 和 time scale，再调用 `MainTimerSync::advance()`；超过用户配置的 `max_physics_steps_per_frame` 时削减 process_step 并限制本帧 physics_steps。
- `main/main_timer_sync.cpp:319-346, 349-429, 432-505, 507-543`：MainTimerSync::advance() 采样经过平滑的 OS 时间；advance_checked() 补偿 time_deficit 并校正 process_step；advance_core() 累积 time_accum，根据过去 12 帧步数历史选择 physics_steps，再返回余量与 interpolation_fraction。
- `main/main_timer_sync.h:35-40, 94-145`：查看 `MainFrameTime` 字段、`time_accum/time_deficit`、12 帧 physics history 与 `advance()` 接口。
- `scene/main/node.cpp:90-108, 4073-4074`：Node 把脚本 `_process` / `_physics_process` 虚方法接入本代调度。

调用摘要：OS 帧循环 → Main::iteration() / MainTimerSync 计算 process step 与 physics steps → 用户步数上限 → 固定循环 → process → RenderingServer sync/draw → AudioServer 更新。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [4921-4959 ; 4970-5053 ; 5062-5097 ; 5112](src/upstream/main/main.cpp.excerpt) | engine/godot-4.7/main/main.cpp |
| 2 | [main_timer_sync.cpp](src/upstream/main/main_timer_sync.cpp) | [319-346 ; 349-429 ; 432-505 ; 507-543](src/upstream/main/main_timer_sync.cpp.excerpt) | engine/godot-4.7/main/main_timer_sync.cpp |
| 3 | [main_timer_sync.h](src/upstream/main/main_timer_sync.h) | [35-40 ; 94-145](src/upstream/main/main_timer_sync.h.excerpt) | engine/godot-4.7/main/main_timer_sync.h |
| 4 | [node.cpp](src/upstream/scene/main/node.cpp) | [90-108 ; 4073-4074](src/upstream/scene/main/node.cpp.excerpt) | engine/godot-4.7/scene/main/node.cpp |

## GDScript 源码复刻

`src/source_replay.gd` 按本课列出的 C++ 入口重建关键数据结构、条件分支和状态更新。它是可逐步阅读的教学移植，不是完整引擎替身；模型函数表会标明直接对应的源码行为和仅用于组织输入/输出的脚手架。平台、线程、对象分配和服务器副作用仍由真实引擎处理。

| 模型函数 | C++ 源码对照或脚手架性质 | 复现的状态与分支 |
| --- | --- | --- |
| `_new_timer()`、`_advance_core()` | `MainTimerSync` 构造函数与 `advance_core` | 初始化 12 项典型步历史，按历史约束确定 physics_steps，并更新 accumulator。 |
| `_get_average_physics_steps()`、`_clamp_value()` | `get_average_physics_steps`、`MainFrameTime::clamp_process_step` | 求出稳定步数区间并实现标量 min/max 限幅。 |
| `_advance_checked()` | `MainTimerSync::advance_checked` | 按源码顺序执行历史区间、jitter 区间、累加器区间和最小 process step 限幅，随后回写 accumulator/deficit/interpolation。 |
| `_limit_physics_steps()` | `Main::iteration max_physics_steps_per_frame` | 执行用户配置的每帧物理 tick 上限。 |
| `_physics_process_tick()` | `Main::iteration` 固定循环、`MainLoop::physics_process`、PhysicsServer sync/step | 展示输入 flush、迭代准备、服务器同步/查询、脚本 physics_process；另走 quit 分支，验证它会在 navigation/server step 前清理状态并退出循环。 |
| `_process_and_draw()` | `Main::iteration` process、NavigationServer、RenderingServer sync/draw、GDExtension/ScriptServer frame、AudioServer update | 固定 tick 后执行普通 process 和消息队列；按窗口/渲染循环、待处理资源、低占用模式、场景变化和强制重绘决定 draw。 |

## 最小 Godot/GDScript 实验

- `project.godot` 指定 `main.tscn` 为运行场景。
- `frame_probe.gd` 计数 `_process` 和 `_physics_process`，累计约一秒后打印次数并退出。

在本目录运行：

```sh
godot --path .
```

观察普通 process 与 physics 回调的计数。物理次数接近项目 physics tick 配置，process 次数取决于实际帧率；两者都不保证固定值。脚本不测量 RenderingServer 或 GPU 工作。

## 简化与边界

模型移植 12 帧典型步数窗口、`advance_checked` 的区间限幅与 deficit 回写、每帧步数上限，以及 process/render/audio 的先后分支。OS delta smoother、固定 FPS 专用路径、time scale 来源、后台线程同步、RenderingDevice 和 GPU 实际提交仍由真实引擎负责；Godot 4.7 项目尚未运行。

## 下一课

继续阅读 [s06_scene_tree_iteration](../s06_scene_tree_iteration/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
