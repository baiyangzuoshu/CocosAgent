# 第 5 课：`Main::iteration()` 的固定步进与帧提交

**目标：** 追踪 Godot 1.1 每次平台帧回调如何累计时间、推进固定步、调用 idle，再把绘制命令提交给 `VisualServer`。

## 本课增量

把固定步累积、每帧 process/idle 与服务器同步绘制接在同一帧模型里，并显式记录步数上限和余量。

**本课要回答：** 为什么一次主循环迭代可能执行零次或多次固定步？固定更新和 idle 更新使用什么时间量？绘制命令在哪一步提交？

## C++ 源码追踪

源码依据：`engine/godot-1.1/`（Godot 1.1 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-1.1/` 快照根目录：

- `main/main.cpp:1315-1338`：`Main::iteration()` 用 OS tick 计算 `step`，按 `iterations_per_second` 得到固定片长，并累计 `time_accum`；单次大步长限制到固定片长的 8 倍。
- `main/main.cpp:1341-1366`：对每个固定片长先同步/刷新物理查询，调用 `MainLoop::iteration()`，再推进 3D/2D PhysicsServer 并冲刷消息队列。
- `main/main.cpp:1372-1400`：固定步之后调用 `MainLoop::idle(step)`；可绘制时调用 `VisualServer::draw()`，不可绘制时 `flush()`，随后更新 AudioServer。
- `scene/main/node.cpp:52-73`、`1892-1893`：SceneTree 驱动 Node 的 `_process` / `_fixed_process` 虚方法；Node 暴露 `set_process()` 与 `set_fixed_process()` 开关。

调用摘要：平台调用 `Main::iteration()` → 累计经过时间 → 零次或多次固定 `MainLoop::iteration()` / 物理服务器步进 → 一次 `MainLoop::idle()` → VisualServer 绘制或刷新。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [1315-1338 ; 1341-1366 ; 1372-1400](src/upstream/main/main.cpp.excerpt) | engine/godot-1.1/main/main.cpp |
| 2 | [node.cpp](src/upstream/scene/main/node.cpp) | [52-73 ; 1892-1893](src/upstream/scene/main/node.cpp.excerpt) | engine/godot-1.1/scene/main/node.cpp |

## GDScript 源码复刻

S05 Godot 1.1: fixed slice accumulator → MainLoop iteration/idle → VisualServer.

source_replay.gd 按本课指定快照复刻控制流与状态传递，模型中的状态字段、函数入口和 API 名称对应本代 C++ 路径。根目录实验脚本先运行模型，再调用对应版本的 Godot API。

| GDScript 函数 | 复刻步骤 |
| --- | --- |
| _advance_clock() | 累计经过时间并计算固定步数、process delta 和余量 |
| _fixed_iteration() | 逐个执行固定物理阶段并记录服务器同步顺序 |
| _idle_and_submit() | 执行一次 process/idle 并记录 draw 或 sync 提交 |

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
