# 第 5 课：`Main::iteration()` 的固定步进与帧提交

**目标：** 追踪 Godot 1.1 每次平台帧回调如何累计时间、推进固定步、调用 idle，再把绘制命令提交给 `VisualServer`。

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

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [摘录](src/upstream/main/main.cpp.excerpt) | `engine/godot-1.1/main/main.cpp` | 1315-1338, 1341-1366 |
| 2 | [node.cpp](src/upstream/scene/main/node.cpp) | [摘录](src/upstream/scene/main/node.cpp.excerpt) | `engine/godot-1.1/scene/main/node.cpp` | 52-73 |

## 可运行源码复刻

课程代码 [`src/source_replay.gd`](src/source_replay.gd) 按本课 C++ 函数关系实现一个小型 GDScript 模型；入口脚本会先运行它，再执行下面的真实引擎 API 实验。阅读时把模型中的状态变化逐步映射到上方的 C++ 摘录。模型只复刻本课选出的路径，不声称等同于完整 Godot 引擎。

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
