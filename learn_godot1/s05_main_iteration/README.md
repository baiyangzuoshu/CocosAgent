# 第 5 课：`Main::iteration()` 的固定步进与帧提交

**目标：** 追踪 Godot 1.1 每次平台帧回调如何累计时间、推进固定步、调用 idle，再把绘制命令提交给 `VisualServer`。

## 本课问题

为什么一次主循环迭代可能执行零次或多次固定步？固定更新和 idle 更新使用什么时间量？绘制命令在哪一步提交？

## C++ 源码追踪

以下路径相对于 `engine/godot-1.1/` 快照根目录：

- `main/main.cpp:1315-1338`：`Main::iteration()` 用 OS tick 计算 `step`，按 `iterations_per_second` 得到固定片长，并累计 `time_accum`；单次大步长限制到固定片长的 8 倍。
- `main/main.cpp:1341-1366`：对每个固定片长先同步/刷新物理查询，调用 `MainLoop::iteration()`，再推进 3D/2D PhysicsServer 并冲刷消息队列。
- `main/main.cpp:1372-1400`：固定步之后调用 `MainLoop::idle(step)`；可绘制时调用 `VisualServer::draw()`，不可绘制时 `flush()`，随后更新 AudioServer。
- `scene/main/node.cpp:52-73`、`1892-1893`：SceneTree 驱动 Node 的 `_process` / `_fixed_process` 虚方法；Node 暴露 `set_process()` 与 `set_fixed_process()` 开关。

调用摘要：平台调用 `Main::iteration()` → 累计经过时间 → 零次或多次固定 `MainLoop::iteration()` / 物理服务器步进 → 一次 `MainLoop::idle()` → VisualServer 绘制或刷新。

## 最小实验

- `engine.cfg` 指向 Godot 1.1 XML `PackedScene` `main.xml`。
- `frame_probe.gd` 开启 idle 与 fixed 回调，累计约一秒后打印两类回调次数并退出。
- 在本目录运行：

```sh
godot -path .
```

观察 `idle callbacks` 与 `fixed callbacks` 两个计数。固定回调次数接近项目配置的每秒物理步数；idle 次数受平台帧率影响。具体值随运行环境变化。绘制提交顺序由静态源码确认，脚本不直接测量 GPU 绘制。

## 简化与边界

实验不更改 time scale、iterations per second、低处理器占用模式或目标 FPS，也不模拟平台事件循环和渲染后端。Godot 1.1 使用 `MainLoop::iteration/idle`、`VisualServer` 和 `_fixed_process`；本课尚未运行项目。

## 本课 C++ 源码摘录

课内摘录保留对应 Godot 源码行段正文，并在段首标出原始行号；完整上下文以只读的 engine 快照为准。摘录用于追踪，不是独立编译单元。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | Godot 源文件 | 上游行段 |
| --- | --- | --- |
| [main.cpp](src/upstream/main/main.cpp.excerpt) | godot-1.1/main/main.cpp | 1315-1338, 1341-1366, 1372-1400 |
| [node.cpp](src/upstream/scene/main/node.cpp.excerpt) | godot-1.1/scene/main/node.cpp | 52-73 |
