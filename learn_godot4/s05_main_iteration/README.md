# 第 5 课：`Main::iteration()` 的固定物理步与帧提交

**目标：** 追踪 Godot 4.7 如何把 OS 时间差变成固定物理更新次数和每帧 delta，再调用脚本回调并提交服务器绘制。

## 本课增量

把定时器的累积状态、物理步数上限、固定循环、每帧回调和渲染服务器提交连成一条可检查的调用链。

## 本课问题

每帧经过的时间如何换算成零次或多次物理更新？引擎如何限制物理步数并留下插值余量？物理循环和 process/idle、绘制的先后关系是什么？

## C++ 源码调用链

源码依据：`engine/godot-4.7/` 本地快照。以下路径相对于该快照根目录，行号对应课程副本中的原始源码：

- `main/main.cpp:4921-4959, 4970-5053, 5062-5097, 5112`：读取 `physics_ticks_per_second`、physics step 和 time scale，再调用 `MainTimerSync::advance()`；超过用户配置的 `max_physics_steps_per_frame` 时削减 process_step 并限制本帧 physics_steps。
- `main/main_timer_sync.cpp:349-429, 432-505, 507-543`：MainTimerSync::advance() 采样经过平滑的 OS 时间；advance_checked() 补偿 time_deficit 并校正 process_step；advance_core() 累积 time_accum，根据过去 12 帧步数历史选择 physics_steps，再返回余量与 interpolation_fraction。
- `main/main_timer_sync.h:35-40, 93-144`：查看 `MainFrameTime` 字段、`time_accum/time_deficit`、12 帧 physics history 与 `advance()` 接口。
- `scene/main/node.cpp:90-108, 4073-4074`：Node 把脚本 `_process` / `_physics_process` 虚方法接入本代调度。

调用摘要：OS 帧循环 → Main::iteration() / MainTimerSync 计算 process step 与 physics steps → 用户步数上限 → 固定循环 → process → RenderingServer sync/draw → AudioServer 更新。

## 本课源码复刻

`src/upstream/` 保存下列完整 C++ 源文件与带原始行号的重点摘录；文件内容复制自对应版本快照，核对清单和边界见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [摘录](src/upstream/main/main.cpp.excerpt) | `engine/godot-4.7/main/main.cpp` | 4921-4959, 4970-5053, 5062-5097, 5112 |
| 2 | [main_timer_sync.cpp](src/upstream/main/main_timer_sync.cpp) | [摘录](src/upstream/main/main_timer_sync.cpp.excerpt) | `engine/godot-4.7/main/main_timer_sync.cpp` | 349-429, 432-505, 507-543 |
| 3 | [main_timer_sync.h](src/upstream/main/main_timer_sync.h) | [摘录](src/upstream/main/main_timer_sync.h.excerpt) | `engine/godot-4.7/main/main_timer_sync.h` | 35-40, 93-144 |
| 4 | [node.cpp](src/upstream/scene/main/node.cpp) | [摘录](src/upstream/scene/main/node.cpp.excerpt) | `engine/godot-4.7/scene/main/node.cpp` | 90-108, 4073-4074 |

## GDScript 源码复刻与 C++ 对照

模型以 55 ms 帧差和 20 ms 固定步演示 accumulator、物理步选择、项目步数上限与插值余量。它省略 MainTimerSync 的 delta smoother、12 帧典型步数历史、jitter fix 和 time_deficit 校正。它是选定算法的单帧教学模型，不是 C++ 的逐行转译，也不替代完整引擎调度。

| C++ 追踪阶段 | 模型函数 | 观察状态或分支 |
| --- | --- | --- |
| `Main::iteration()` → `MainTimerSync::advance()` → `advance_checked/core()` | `_measure_frame_time()` | 跟踪采样时间、accumulator、步数、上限与插值余量（历史平滑省略） |
| 固定物理循环 | `_physics_tick()` | 记录准备、`MainLoop::physics_process()`、PhysicsServer step 和循环收尾 |
| 每帧回调与绘制 | `_process_idle()` → `_render_frame()` | 观察 `RenderingServer` 同步及条件绘制分支 |

项目入口先运行 `src/source_replay.gd`，再执行下面的公开 API 实验。模型的 55 ms / 20 ms 数据是教学输入，不是目标平台的性能测量。

## 最小 Godot/GDScript 实验

- `project.godot` 指定 `main.tscn` 为运行场景。
- `frame_probe.gd` 计数 `_process` 和 `_physics_process`，累计约一秒后打印次数并退出。

在本目录运行：

```sh
godot --path .
```

观察普通 process 与 physics 回调的计数。物理次数接近项目 physics tick 配置，process 次数取决于实际帧率；两者都不保证固定值。脚本不测量 RenderingServer 或 GPU 工作。

## 简化与边界

不改变 physics tick rate、最大 physics steps、time scale、固定 FPS 或渲染模式，也不模拟 12 帧历史、delta smoother 和 jitter fix 的全部校正。教学模型只复现 accumulator、用户步数上限和阶段顺序；Godot 4.7 使用 RenderingServer 与本代 MainFrameTime，课程未运行。

## 下一课

继续阅读 [s06_scene_tree_iteration](../s06_scene_tree_iteration/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
