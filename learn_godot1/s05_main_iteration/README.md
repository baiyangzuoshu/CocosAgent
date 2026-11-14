# 第 5 课：`Main::iteration()` 的固定步进与帧提交

**目标：** 追踪 Godot 1.1 每次平台帧回调如何累计时间、推进固定步、调用 idle，再把绘制命令提交给 `VisualServer`。

## 本课增量

把固定步累积、每帧 process/idle 与服务器同步绘制接在同一帧模型里，并显式记录步数上限和余量。

## 本课问题

为什么一次主循环迭代可能执行零次或多次固定步？固定更新和 idle 更新使用什么时间量？绘制命令在哪一步提交？

## 源码调用链

源码依据：`engine/godot-1.1/`（Godot 1.1 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-1.1/` 快照根目录：

- `main/main.cpp:1315-1338`：`Main::iteration()` 用 OS tick 计算 `step`，按 `iterations_per_second` 得到固定片长，并累计 `time_accum`；单次大步长限制到固定片长的 8 倍。
- `main/main.cpp:1341-1366`：对每个固定片长先同步/刷新物理查询，调用 `MainLoop::iteration()`，再推进 3D/2D PhysicsServer 并冲刷消息队列。
- `main/main.cpp:1372-1400`：固定步之后调用 `MainLoop::idle(step)`；可绘制时调用 `VisualServer::draw()`，不可绘制时 `flush()`，随后更新 AudioServer。
- `scene/main/node.cpp:52-73`、`1892-1893`：SceneTree 驱动 Node 的 `_process` / `_fixed_process` 虚方法；Node 暴露 `set_process()` 与 `set_fixed_process()` 开关。

调用摘要：平台调用 `Main::iteration()` → 累计经过时间 → 零次或多次固定 `MainLoop::iteration()` / 物理服务器步进 → 一次 `MainLoop::idle()` → VisualServer 绘制或刷新。

## 本课源码复刻

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-1.1` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [摘录](src/upstream/main/main.cpp.excerpt) | `engine/godot-1.1/main/main.cpp` | 1315-1338, 1341-1366, 1372-1400 |
| 2 | [node.cpp](src/upstream/scene/main/node.cpp) | [摘录](src/upstream/scene/main/node.cpp.excerpt) | `engine/godot-1.1/scene/main/node.cpp` | 52-73, 1892-1893 |

## GDScript 源码复刻与 C++ 对照

模型从零初始余量开始，用固定 55 ms step 和 20 ms frame_slice 复现单次输入限幅、time_accum 消耗、fixed 次数与余量；真实时间由 OS 提供，跨帧余量和后端绘制以对应版本源码为准。

src/upstream/ 保存本课引用的完整上游文件副本和带原始行号的摘录；src/source_replay.gd 执行表中的教学模型。先观察模型如何改变状态或走分支，再回到对应 C++ 函数核对。模型不替代 C++，也不代表引擎运行时本身。

| C++ 追踪阶段 | 模型函数 | 运行时要观察什么 |
| --- | --- | --- |
| Main::iteration elapsed-time accumulator | _measure_frame_time() | 计算固定步数、帧 delta 和余量 |
| fixed/physics iteration | _physics_tick() | 记录准备、回调、服务器 step 和队列冲刷 |
| idle/process and rendering | _process_idle() → _render_frame() | 展示分代帧回调及可绘制条件 |

独立项目入口先调用 source_replay.gd，再执行真实 Godot API 实验。实验脚本：frame_probe.gd。模型输出是确定性的教学数据；只有实际用对应版本 Godot 运行后，才能记录为引擎实验验证。

## 最小 Godot/GDScript 实验

- `engine.cfg` 指向 Godot 1.1 XML `PackedScene` `main.xml`。
- `frame_probe.gd` 开启 idle 与 fixed 回调，累计约一秒后打印两类回调次数并退出。
- 在本目录运行：

```sh
godot -path .
```

观察 `idle callbacks` 与 `fixed callbacks` 两个计数。固定回调次数接近项目配置的每秒物理步数；idle 次数受平台帧率影响。具体值随运行环境变化。绘制提交顺序由静态源码确认，脚本不直接测量 GPU 绘制。

## 简化与边界

实验不更改 time scale、iterations per second、低处理器占用模式或目标 FPS，也不模拟平台事件循环和渲染后端。Godot 1.1 使用 `MainLoop::iteration/idle`、`VisualServer` 和 `_fixed_process`；本课尚未运行项目。

## 下一课

继续阅读 [s06_scene_main_loop](../s06_scene_main_loop/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
