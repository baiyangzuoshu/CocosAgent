# 第 5 课：`Main::iteration()` 的固定步进与帧绘制

**目标：** 追踪 Godot 2.1 `Main::iteration()` 如何累计经过时间、执行零次或多次固定更新，再调用 idle 并同步/绘制 `VisualServer`。

## 本课增量

把固定步累积、每帧 process/idle 与服务器同步绘制接在同一帧模型里，并显式记录步数上限和余量。

## 本课问题

固定步长如何从 OS 时间差得到？SceneTree 固定回调和 idle 回调处在主循环的什么位置？绘制何时发生？

## 源码调用链

源码依据：`engine/godot-2.1/`（Godot 2.1 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-2.1/` 快照根目录：

- `main/main.cpp:1494-1520`：`Main::iteration()` 读取 tick，按 `iterations_per_second` 计算 `frame_slice`，累计经过时间；单次 `step` 上限为 8 个固定片长。
- `main/main.cpp:1523-1550`：固定步循环中先同步/刷新 2D/3D 物理，再调用 `MainLoop::iteration()`、物理服务器 `step()` 并冲刷消息队列。
- `main/main.cpp:1557-1583`：固定循环后调用 `MainLoop::idle()`，同步 VisualServer，在允许绘制时调用 `draw()`，随后更新 AudioServer。
- `scene/main/node.cpp:52-73`、`2179-2180`：SceneTree 更新 Node 的 `_process` / `_fixed_process`，并注册这两个脚本虚方法。

调用摘要：OS 帧循环 → `Main::iteration()` 采样时间 → 固定 `MainLoop::iteration()` 与 PhysicsServer 步进 → `MainLoop::idle()` → VisualServer sync/draw。

## 本课源码复刻

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-2.1` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [摘录](src/upstream/main/main.cpp.excerpt) | `engine/godot-2.1/main/main.cpp` | 1494-1520, 1523-1550, 1557-1583 |
| 2 | [node.cpp](src/upstream/scene/main/node.cpp) | [摘录](src/upstream/scene/main/node.cpp.excerpt) | `engine/godot-2.1/scene/main/node.cpp` | 52-73, 2179-2180 |

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

- `engine.cfg` 使用 Godot 2.1 项目配置，指定文本场景 `main.tscn`。
- `frame_probe.gd` 分别计数 idle 与 fixed 回调；累计约一秒后打印次数并请求退出。
- 在本目录运行：

```sh
godot -path .
```

观察两类回调计数。fixed 次数接近配置的每秒物理步数，idle 次数随平台帧率变化；实际数字不固定。`VisualServer::sync/draw` 的执行位置由 C++ 代码确认，GDScript 不测量 GPU 工作。

## 简化与边界

不修改 physics tick、time scale、目标 FPS 或低处理器占用设置，不覆盖各平台不同的事件循环。Godot 2.1 使用 `SceneTree::iteration()`、`idle()`、`VisualServer` 与 `_fixed_process`；本课尚未运行项目。

## 下一课

继续阅读 [s06_scenetree_iteration](../s06_scenetree_iteration/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
