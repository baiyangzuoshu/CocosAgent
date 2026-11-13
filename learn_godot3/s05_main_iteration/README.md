# 第 5 课：`Main::iteration()` 的帧时钟、物理步与绘制

**目标：** 追踪 Godot 3.6 如何由 `MainFrameTime` 计算 idle delta 和待执行物理步，驱动 `MainLoop`，再同步并绘制 `VisualServer`。

## 本课问题

一次渲染帧如何决定物理步数？物理步数过多时如何限幅？物理更新与 idle 更新之后，何时同步渲染服务器？

## C++ 源码追踪

以下路径相对于 `engine/godot-3.6/` 快照根目录：

- `main/main.cpp:2304-2359`：读取帧时间，以 `MainFrameTime::advance()` 取得 idle step 与 physics steps；非固定 FPS 模式下将每帧物理步数限制为 8。
- `main/main.cpp:2363-2410`：逐个固定步执行 `iteration_prepare()`、`MainLoop::iteration()`、物理服务器同步/step 与 `iteration_end()`。
- `main/main.cpp:2420-2453`、`2472`：物理循环后调用 `MainLoop::idle()`，冲刷消息队列并同步 `VisualServer`；允许绘制时调用 `draw()`，之后更新 AudioServer。
- `scene/main/node.cpp:50-70`、`3275-3276`：Node 将 `_process` / `_physics_process` 脚本回调接入本代处理队列。

调用摘要：采样 OS 时间 → `MainFrameTime` 计算 idle delta/physics steps → 零次或多次固定循环 → 一次 idle → VisualServer sync/条件绘制 → 音频与脚本帧收尾。

## 最小实验

- `project.godot` 指定本目录的 `main.tscn`。
- `frame_probe.gd` 计数 `_process` 与 `_physics_process`，累计约一秒后打印并退出。
- 在本目录运行：

```sh
godot --path .
```

观察 idle 和 physics 回调计数。physics 次数接近项目物理 tick 配置，process 次数随实际帧率变化；环境、帧率限制和卡顿会改变数字。实验只观察脚本回调，`VisualServer::sync/draw` 由静态源码追踪。

## 简化与边界

不调整 physics tick、fixed FPS、time scale、delta 同步策略或 low-processor 模式；也不测量物理服务器耗时与 GPU 帧时间。Godot 3.6 的 `VisualServer`、`MainFrameTime` 和 8 步上限是本快照实现，本课未运行。
