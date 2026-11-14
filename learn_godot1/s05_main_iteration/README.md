# 第 5 课：`Main::iteration()` 的固定步进与帧提交

**目标：** 追踪 Godot 1.1 每次平台帧回调如何累计时间、推进固定步、调用 idle，再把绘制命令提交给 `VisualServer`。

## 本课增量

把固定步累积、每帧 process/idle 与服务器同步绘制接在同一帧模型里，并显式记录步数上限和余量。

**本课要回答：** 为什么一次主循环迭代可能执行零次或多次固定步？固定更新和 idle 更新使用什么时间量？绘制命令在哪一步提交？

## C++ 源码追踪

源码依据：`engine/godot-1.1/`（Godot 1.1 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-1.1/` 快照根目录：

- `main/main.cpp:1315-1338`：`Main::iteration()` 用 OS tick 计算 `step`，按 `iterations_per_second` 得到 `frame_slice`，先把 `step` 限制到 8 个片长，再累加 `time_accum`。
- `main/main.cpp:1341-1366`：对每个固定片长先同步/刷新物理查询，调用 `MainLoop::iteration()`，再推进 3D/2D PhysicsServer 并冲刷消息队列。
- `main/main.cpp:1372-1400`：固定步之后调用 `MainLoop::idle(step)`；可绘制时调用 `VisualServer::draw()`，不可绘制时 `flush()`，随后更新 AudioServer。
- `scene/main/node.cpp:52-73`、`1892-1893`：SceneTree 驱动 Node 的 `_process` / `_fixed_process` 虚方法；Node 暴露 `set_process()` 与 `set_fixed_process()` 开关。

调用摘要：平台调用 `Main::iteration()` → 累计经过时间 → 零次或多次固定 `MainLoop::iteration()` / 物理服务器步进 → 一次 `MainLoop::idle()` → VisualServer 绘制或刷新。

逐段核对时留意两个条件：循环使用严格的 `time_accum > frame_slice`；传给 idle 的是本帧被截断后的 `step`，不是固定循环结束后的余数。模型用 `0.055s` 和 `0.020s` 演示两次固定步后留下 `0.015s`；`0.300s` 输入先截到 `0.160s`，严格大于条件会留下恰好一个 `frame_slice`。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [1315-1338 ; 1341-1366 ; 1372-1400](src/upstream/main/main.cpp.excerpt) | engine/godot-1.1/main/main.cpp |
| 2 | [node.cpp](src/upstream/scene/main/node.cpp) | [52-73 ; 1892-1893](src/upstream/scene/main/node.cpp.excerpt) | engine/godot-1.1/scene/main/node.cpp |

## GDScript 源码复刻

`src/source_replay.gd` 按本课列出的 C++ 入口重建关键数据结构、条件分支和状态更新。它是可逐步阅读的教学移植，不是完整引擎替身；模型函数表会标明直接对应的源码行为和仅用于组织输入/输出的脚手架。平台、线程、对象分配和服务器副作用仍由真实引擎处理。

| 模型函数 | C++ 源码对照或脚手架性质 | 复现的状态与分支 |
| --- | --- | --- |
| `_advance_clock()`、`_run_fixed_loop()` | `Main::iteration` 的 tick 截断、累加器与严格固定循环 | 保留 8 片长截断、每次循环减去一片长，以及主循环请求退出时提前跳出而不减片长的分支。 |
| `_fixed_iteration()` | `Main::iteration` 固定循环主体 | 按顺序记录 PhysicsServer/Physics2DServer 同步与 query flush、`MainLoop::iteration`、消息队列、服务器 step。 |
| `_idle_and_submit()` | `Main::iteration` idle、draw/flush 与 AudioServer 尾段 | idle 使用本帧截断后的 step；区分低处理器模式、场景未变、不可绘制和正常绘制。 |

## 最小 Godot/GDScript 实验

- `engine.cfg` 指向 Godot 1.1 XML `PackedScene` `main.xml`。
- `frame_probe.gd` 开启 idle 与 fixed 回调，累计约一秒后打印两类回调次数并退出。
- 在本目录运行：

```sh
godot -path .
```

观察 `idle callbacks` 与 `fixed callbacks` 两个计数。固定回调次数接近项目配置的每秒物理步数；idle 次数受平台帧率影响。具体值随运行环境变化。绘制提交顺序由静态源码确认，脚本不直接测量 GPU 绘制。

## 简化与边界

模型逐段移植本课摘录中的计时、退出门控和 draw/flush 分支；OS tick、真实 PhysicsServer/VisualServer 副作用、目标 FPS 和平台事件循环仍由真实引擎负责。Godot 1.1 使用 `MainLoop::iteration/idle`、`VisualServer` 和 `_fixed_process`；本课尚未运行项目。

## 下一课

继续阅读 [s06_scene_main_loop](../s06_scene_main_loop/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
