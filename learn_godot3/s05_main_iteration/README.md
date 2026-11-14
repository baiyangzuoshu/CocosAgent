# 第 5 课：`Main::iteration()` 的固定物理步与帧提交

**目标：** 追踪 Godot 3.6 如何把 OS 时间差变成固定物理更新次数和每帧 delta，再调用脚本回调并提交服务器绘制。

## 本课增量

把定时器的累积状态、物理步数上限、固定循环、每帧回调和渲染服务器提交连成一条可检查的调用链。

## 本课问题

每帧经过的时间如何换算成零次或多次物理更新？引擎如何限制物理步数并留下插值余量？物理循环和 process/idle、绘制的先后关系是什么？

## C++ 源码调用链

源码依据：`engine/godot-3.6/` 本地快照。以下路径相对于该快照根目录，行号对应课程副本中的原始源码：

- `main/main.cpp:2304-2359, 2363-2410, 2420-2453, 2472`：采样帧时间并调用 `MainTimerSync::advance()`；在非 fixed-FPS 模式下把单帧物理步数限制为 8，并据此削减传给 idle 的 step。
- `main/main_timer_sync.cpp:322-403, 405-479, 481-522`：MainTimerSync::advance() 采样经过平滑的 OS 时间；advance_checked() 补偿 time_deficit 并校正 idle_step；advance_core() 累积 time_accum，根据过去 12 帧步数历史选择 physics_steps，再返回余量与 interpolation_fraction。
- `main/main_timer_sync.h:39-44, 111-162`：查看 `MainFrameTime` 字段、`time_accum/time_deficit`、12 帧 physics history 与 `advance()` 接口。
- `scene/main/node.cpp:50-70, 3275-3276`：Node 把 `_process` / `_physics_process` 脚本回调接入本代处理队列。

调用摘要：OS 时间 → MainTimerSync 平滑并校正 idle step → physics accumulator/history → 8 步上限 → 固定循环 → idle → VisualServer sync/draw。

## 本课源码复刻

`src/upstream/` 保存下列完整 C++ 源文件与带原始行号的重点摘录；文件内容复制自对应版本快照，核对清单和边界见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [摘录](src/upstream/main/main.cpp.excerpt) | `engine/godot-3.6/main/main.cpp` | 2304-2359, 2363-2410, 2420-2453, 2472 |
| 2 | [main_timer_sync.cpp](src/upstream/main/main_timer_sync.cpp) | [摘录](src/upstream/main/main_timer_sync.cpp.excerpt) | `engine/godot-3.6/main/main_timer_sync.cpp` | 322-403, 405-479, 481-522 |
| 3 | [main_timer_sync.h](src/upstream/main/main_timer_sync.h) | [摘录](src/upstream/main/main_timer_sync.h.excerpt) | `engine/godot-3.6/main/main_timer_sync.h` | 39-44, 111-162 |
| 4 | [node.cpp](src/upstream/scene/main/node.cpp) | [摘录](src/upstream/scene/main/node.cpp.excerpt) | `engine/godot-3.6/scene/main/node.cpp` | 50-70, 3275-3276 |

## GDScript 源码复刻与 C++ 对照

模型以 55 ms 帧差和 20 ms 固定步演示 accumulator、物理步选择、8 步上限与插值余量。它省略 MainTimerSync 的 delta smoother、12 帧典型步数历史、jitter fix 和 time_deficit 校正。它是选定算法的单帧教学模型，不是 C++ 的逐行转译，也不替代完整引擎调度。

| C++ 追踪阶段 | 模型函数 | 观察状态或分支 |
| --- | --- | --- |
| `Main::iteration()` → `MainTimerSync::advance()` → `advance_checked/core()` | `_measure_frame_time()` | 跟踪采样时间、accumulator、步数、上限与插值余量（历史平滑省略） |
| 固定物理循环 | `_physics_tick()` | 记录准备、`MainLoop::iteration()`、PhysicsServer step 和循环收尾 |
| 每帧回调与绘制 | `_process_idle()` → `_render_frame()` | 观察 `VisualServer` 同步及条件绘制分支 |

项目入口先运行 `src/source_replay.gd`，再执行下面的公开 API 实验。模型的 55 ms / 20 ms 数据是教学输入，不是目标平台的性能测量。

## 最小 Godot/GDScript 实验

- `project.godot` 指定本目录的 `main.tscn`。
- `frame_probe.gd` 计数 `_process` 与 `_physics_process`，累计约一秒后打印并退出。

在本目录运行：

```sh
godot --path .
```

观察 idle 和 physics 回调计数。physics 次数接近项目物理 tick 配置，process 次数随实际帧率变化；环境、帧率限制和卡顿会改变数字。脚本只观察公开回调，不测量服务器或 GPU 工作。

## 简化与边界

不调整 physics tick、fixed FPS、time scale、delta 同步策略或 low-processor 模式，也不模拟 12 帧历史、delta smoother 和 jitter fix 的全部校正。教学模型只复现 accumulator、固定步数、8 步上限和阶段顺序；Godot 3.6 的 VisualServer/MainFrameTime 行为以本地快照为准，课程未运行。

## 下一课

继续阅读 [s06_scenetree_iteration](../s06_scenetree_iteration/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
