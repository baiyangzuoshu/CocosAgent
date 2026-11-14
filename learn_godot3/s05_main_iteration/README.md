# 第 5 课：`Main::iteration()` 的固定物理步与帧提交

**目标：** 追踪 Godot 3.6 如何把 OS 时间差变成固定物理更新次数和每帧 delta，再调用脚本回调并提交服务器绘制。

## 本课增量

把定时器的累积状态、物理步数上限、固定循环、每帧回调和渲染服务器提交连成一条可检查的调用链。

**本课要回答：** 每帧经过的时间如何换算成零次或多次物理更新？引擎如何限制物理步数并留下插值余量？物理循环和 process/idle、绘制的先后关系是什么？

## C++ 源码追踪

源码依据：`engine/godot-3.6/` 本地快照。以下路径相对于该快照根目录，行号对应课程副本中的原始源码：

- `main/main.cpp:2304-2359, 2363-2410, 2420-2453, 2472`：采样帧时间并调用 `MainTimerSync::advance()`；在非 fixed-FPS 模式下把单帧物理步数限制为 8，并据此削减传给 idle 的 step。
- `main/main_timer_sync.cpp:322-403, 405-479, 481-522`：MainTimerSync::advance() 采样经过平滑的 OS 时间；advance_checked() 补偿 time_deficit 并校正 idle_step；advance_core() 累积 time_accum，根据过去 12 帧步数历史选择 physics_steps，再返回余量与 interpolation_fraction。
- `main/main_timer_sync.h:39-44, 111-162`：查看 `MainFrameTime` 字段、`time_accum/time_deficit`、12 帧 physics history 与 `advance()` 接口。
- `scene/main/node.cpp:50-70, 3275-3276`：Node 把 `_process` / `_physics_process` 脚本回调接入本代处理队列。

调用摘要：OS 时间 → MainTimerSync 平滑并校正 idle step → physics accumulator/history → 8 步上限 → 固定循环 → idle → VisualServer sync/draw。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [2304-2359 ; 2363-2410 ; 2420-2453 ; 2472](src/upstream/main/main.cpp.excerpt) | engine/godot-3.6/main/main.cpp |
| 2 | [main_timer_sync.cpp](src/upstream/main/main_timer_sync.cpp) | [322-403 ; 405-479 ; 481-522](src/upstream/main/main_timer_sync.cpp.excerpt) | engine/godot-3.6/main/main_timer_sync.cpp |
| 3 | [main_timer_sync.h](src/upstream/main/main_timer_sync.h) | [39-44 ; 111-162](src/upstream/main/main_timer_sync.h.excerpt) | engine/godot-3.6/main/main_timer_sync.h |
| 4 | [node.cpp](src/upstream/scene/main/node.cpp) | [50-70 ; 3275-3276](src/upstream/scene/main/node.cpp.excerpt) | engine/godot-3.6/scene/main/node.cpp |

## GDScript 源码复刻

S05 Godot 3.6: MainTimerSync accumulator plus Main::iteration physics cap.

source_replay.gd 按本课指定快照复刻控制流与状态传递，模型中的状态字段、函数入口和 API 名称对应本代 C++ 路径。根目录实验脚本先运行模型，再调用对应版本的 Godot API。

| GDScript 函数 | 复刻步骤 |
| --- | --- |
| _advance_core() | 累计经过时间并计算固定步数、process delta 和余量 |
| _apply_frame_cap() | 应用最大 physics tick 数并修正普通帧 delta |
| _physics_tick() | 逐个执行固定物理阶段并记录服务器同步顺序 |
| _idle_draw() | 执行一次 process/idle 并记录 draw 或 sync 提交 |

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
