# 第 5 课：`Main::iteration()` 的固定步进与帧绘制

**目标：** 追踪 Godot 2.1 `Main::iteration()` 如何累计经过时间、执行零次或多次固定更新，再调用 idle 并同步/绘制 `VisualServer`。

## 本课增量

把固定步累积、每帧 process/idle 与服务器同步绘制接在同一帧模型里，并显式记录步数上限和余量。

**本课要回答：** 固定步长如何从 OS 时间差得到？SceneTree 固定回调和 idle 回调处在主循环的什么位置？绘制何时发生？

## C++ 源码追踪

源码依据：`engine/godot-2.1/`（Godot 2.1 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-2.1/` 快照根目录：

- `main/main.cpp:1494-1520`：`Main::iteration()` 读取 tick，按 `iterations_per_second` 计算 `frame_slice`，先把单帧 `step` 限制为 8 个片长，再累计经过时间。
- `main/main.cpp:1523-1550`：固定步循环中先同步/刷新 2D/3D 物理，再调用 `MainLoop::iteration()`、物理服务器 `step()` 并冲刷消息队列。
- `main/main.cpp:1557-1583`：固定循环后调用 `MainLoop::idle()`，同步 VisualServer，在允许绘制时调用 `draw()`，随后更新 AudioServer。
- `scene/main/node.cpp:52-73`、`2179-2180`：SceneTree 更新 Node 的 `_process` / `_fixed_process`，并注册这两个脚本虚方法。

调用摘要：OS 帧循环 → `Main::iteration()` 采样时间 → 固定 `MainLoop::iteration()` 与 PhysicsServer 步进 → `MainLoop::idle()` → VisualServer sync/draw。

逐段核对时留意固定循环的严格条件 `time_accum > frame_slice`。模型以 `0.055s`、`0.020s` 展示两次固定更新并留下 `0.015s`；若输入 `0.300s`，引擎先截到 `0.160s`，循环会留下恰好 `0.020s`。idle 仍接收被截断后的帧 step，乘上 time scale 后每帧执行一次。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [1494-1520 ; 1523-1550 ; 1557-1583](src/upstream/main/main.cpp.excerpt) | engine/godot-2.1/main/main.cpp |
| 2 | [node.cpp](src/upstream/scene/main/node.cpp) | [52-73 ; 2179-2180](src/upstream/scene/main/node.cpp.excerpt) | engine/godot-2.1/scene/main/node.cpp |

## GDScript 源码复刻

`src/source_replay.gd` 按本课列出的 C++ 入口重建关键数据结构、条件分支和状态更新。它是可逐步阅读的教学移植，不是完整引擎替身；模型函数表会标明直接对应的源码行为和仅用于组织输入/输出的脚手架。平台、线程、对象分配和服务器副作用仍由真实引擎处理。

| 模型函数 | C++ 源码对照或脚手架性质 | 复现的状态与分支 |
| --- | --- | --- |
| `_advance_time()`、`_run_fixed_loop()` | `Main::iteration` 的 tick 截断、累加器与严格固定循环 | 保留 8 片长截断、每次循环减一片长，以及 quit 时提前跳出、不继续物理步进的分支。 |
| `_fixed_step()` | `Main::iteration` 固定循环主体 | 逐项记录 3D/2D PhysicsServer sync 与 query flush、MainLoop 回调、服务器 step 和两次消息队列 flush。 |
| `_idle_and_draw()` | `Main::iteration` idle、VisualServer sync/draw、AudioServer update | idle 使用帧 step 而非 accumulator 余数；展示低处理器模式下未变化时跳过 draw。 |

## 最小 Godot/GDScript 实验

- `engine.cfg` 使用 Godot 2.1 项目配置，指定文本场景 `main.tscn`。
- `frame_probe.gd` 分别计数 idle 与 fixed 回调；累计约一秒后打印次数并请求退出。
- 在本目录运行：

```sh
godot -path .
```

观察两类回调计数。fixed 次数接近配置的每秒物理步数，idle 次数随平台帧率变化；实际数字不固定。`VisualServer::sync/draw` 的执行位置由 C++ 代码确认，GDScript 不测量 GPU 工作。

## 简化与边界

模型移植摘录中的计时与条件分支；OS 时钟、真实服务器操作、目标 FPS 和平台事件循环仍由真实引擎完成。Godot 2.1 使用 `SceneTree::iteration()`、`idle()`、`VisualServer` 与 `_fixed_process`；本课尚未运行项目。

## 下一课

继续阅读 [s06_scenetree_iteration](../s06_scenetree_iteration/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
