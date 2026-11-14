# 第 5 课：`Main::iteration()` 的帧时钟、物理步与绘制

**目标：** 追踪 Godot 3.6 如何由 `MainFrameTime` 计算 idle delta 和待执行物理步，驱动 `MainLoop`，再同步并绘制 `VisualServer`。

## 本课问题

一次渲染帧如何决定物理步数？物理步数过多时如何限幅？物理更新与 idle 更新之后，何时同步渲染服务器？

## 源码调用链

源码依据：`engine/godot-3.6/`（Godot 3.6 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-3.6/` 快照根目录：

- `main/main.cpp:2304-2359`：读取帧时间，以 `MainFrameTime::advance()` 取得 idle step 与 physics steps；非固定 FPS 模式下将每帧物理步数限制为 8。
- `main/main.cpp:2363-2410`：逐个固定步执行 `iteration_prepare()`、`MainLoop::iteration()`、物理服务器同步/step 与 `iteration_end()`。
- `main/main.cpp:2420-2453`、`2472`：物理循环后调用 `MainLoop::idle()`，冲刷消息队列并同步 `VisualServer`；允许绘制时调用 `draw()`，之后更新 AudioServer。
- `scene/main/node.cpp:50-70`、`3275-3276`：Node 将 `_process` / `_physics_process` 脚本回调接入本代处理队列。

调用摘要：采样 OS 时间 → `MainFrameTime` 计算 idle delta/physics steps → 零次或多次固定循环 → 一次 idle → VisualServer sync/条件绘制 → 音频与脚本帧收尾。

## 本课源码复刻

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-3.6` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [摘录](src/upstream/main/main.cpp.excerpt) | `engine/godot-3.6/main/main.cpp` | 2304-2359 |
| 2 | [node.cpp](src/upstream/scene/main/node.cpp) | [摘录](src/upstream/scene/main/node.cpp.excerpt) | `engine/godot-3.6/scene/main/node.cpp` | 50-70 |

## 可运行源码复刻

课程代码 [`src/source_replay.gd`](src/source_replay.gd) 按本课 C++ 函数关系实现一个小型 GDScript 模型；入口脚本会先运行它，再执行下面的真实引擎 API 实验。阅读时把模型中的状态变化逐步映射到上方的 C++ 摘录。模型只复刻本课选出的路径，不声称等同于完整 Godot 引擎。

## 最小 Godot/GDScript 实验

- `project.godot` 指定本目录的 `main.tscn`。
- `frame_probe.gd` 计数 `_process` 与 `_physics_process`，累计约一秒后打印并退出。
- 在本目录运行：

```sh
godot --path .
```

观察 idle 和 physics 回调计数。physics 次数接近项目物理 tick 配置，process 次数随实际帧率变化；环境、帧率限制和卡顿会改变数字。实验只观察脚本回调，`VisualServer::sync/draw` 由静态源码追踪。

## 简化与边界

不调整 physics tick、fixed FPS、time scale、delta 同步策略或 low-processor 模式；也不测量物理服务器耗时与 GPU 帧时间。Godot 3.6 的 `VisualServer`、`MainFrameTime` 和 8 步上限是本快照实现，本课未运行。

## 下一课

继续阅读 [s06_scenetree_iteration](../s06_scenetree_iteration/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
