# 第 5 课：`Main::iteration()` 的物理 tick、process 与绘制

**目标：** 追踪 Godot 4.7 如何从 `MainFrameTime` 计算固定物理步与普通帧 delta，调用 `MainLoop.physics_process/process`，再提交 `RenderingServer` 绘制。

## 本课问题

物理 tick rate 如何产生固定步长？每帧物理步数受什么限制？`process()` 与物理步循环的相对顺序是什么？

## C++ 源码追踪

以下路径相对于 `engine/godot-4.7/` 快照根目录：

- `main/main.cpp:4921-4959`：读取 `physics_ticks_per_second`，用 `MainFrameTime::advance()` 取得 process step 与 physics steps；超过项目每帧上限时削减待处理步数。
- `main/main.cpp:4970-5053`：每个物理步调用 `iteration_prepare()`、`MainLoop::physics_process()`、2D/3D 物理服务器 step 和 `iteration_end()`。
- `main/main.cpp:5062-5097`：物理循环之后每帧调用一次 `MainLoop::process()`，再同步 RenderingServer，并在可绘制或有待处理资源时调用 `draw()`。
- `main/main.cpp:5112`：主迭代末段更新 AudioServer。
- `scene/main/node.cpp:90-108`、`4073-4074`：Node 将脚本 `_process` / `_physics_process` 虚方法接入本代调度。

调用摘要：OS 帧循环 → `Main::iteration()` 计算 process step 与 physics steps → 零次或多次固定物理循环 → 一次 process → RenderingServer sync/条件绘制 → AudioServer 更新。

## 最小实验

- `project.godot` 指定 `main.tscn` 为运行场景。
- `frame_probe.gd` 计数 `_process` 和 `_physics_process`，累计约一秒后打印次数并退出。
- 在本目录运行：

```sh
godot --path .
```

观察普通 process 与 physics 回调的计数。物理次数接近项目 physics tick 配置，process 次数取决于实际帧率；两者都不保证固定的输出值。脚本不测量 RenderingServer 或 GPU 工作。

## 简化与边界

不改变 physics tick rate、最大 physics steps、time scale、固定 FPS 或渲染模式。Godot 4.7 使用 `physics_process/process`、`RenderingServer` 与本代 `MainFrameTime`；本课依据静态源码，尚未运行。
