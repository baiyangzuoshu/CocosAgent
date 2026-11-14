# 第 5 课：`Main::iteration()` 的物理 tick、process 与绘制

**目标：** 追踪 Godot 4.7 如何从 `MainFrameTime` 计算固定物理步与普通帧 delta，调用 `MainLoop.physics_process/process`，再提交 `RenderingServer` 绘制。

## 本课问题

物理 tick rate 如何产生固定步长？每帧物理步数受什么限制？`process()` 与物理步循环的相对顺序是什么？

## 源码调用链

源码依据：`engine/godot-4.7/`（Godot 4.7 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-4.7/` 快照根目录：

- `main/main.cpp:4921-4959`：读取 `physics_ticks_per_second`，用 `MainFrameTime::advance()` 取得 process step 与 physics steps；超过项目每帧上限时削减待处理步数。
- `main/main.cpp:4970-5053`：每个物理步调用 `iteration_prepare()`、`MainLoop::physics_process()`、2D/3D 物理服务器 step 和 `iteration_end()`。
- `main/main.cpp:5062-5097`：物理循环之后每帧调用一次 `MainLoop::process()`，再同步 RenderingServer，并在可绘制或有待处理资源时调用 `draw()`。
- `main/main.cpp:5112`：主迭代末段更新 AudioServer。
- `scene/main/node.cpp:90-108`、`4073-4074`：Node 将脚本 `_process` / `_physics_process` 虚方法接入本代调度。

调用摘要：OS 帧循环 → `Main::iteration()` 计算 process step 与 physics steps → 零次或多次固定物理循环 → 一次 process → RenderingServer sync/条件绘制 → AudioServer 更新。

## 本课源码复刻

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-4.7` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [摘录](src/upstream/main/main.cpp.excerpt) | `engine/godot-4.7/main/main.cpp` | 4921-4959 |
| 2 | [node.cpp](src/upstream/scene/main/node.cpp) | [摘录](src/upstream/scene/main/node.cpp.excerpt) | `engine/godot-4.7/scene/main/node.cpp` | 90-108 |

## 可运行源码复刻

课程代码 [`src/source_replay.gd`](src/source_replay.gd) 按本课 C++ 函数关系实现一个小型 GDScript 模型；入口脚本会先运行它，再执行下面的真实引擎 API 实验。阅读时把模型中的状态变化逐步映射到上方的 C++ 摘录。模型只复刻本课选出的路径，不声称等同于完整 Godot 引擎。

## 最小 Godot/GDScript 实验

- `project.godot` 指定 `main.tscn` 为运行场景。
- `frame_probe.gd` 计数 `_process` 和 `_physics_process`，累计约一秒后打印次数并退出。
- 在本目录运行：

```sh
godot --path .
```

观察普通 process 与 physics 回调的计数。物理次数接近项目 physics tick 配置，process 次数取决于实际帧率；两者都不保证固定的输出值。脚本不测量 RenderingServer 或 GPU 工作。

## 简化与边界

不改变 physics tick rate、最大 physics steps、time scale、固定 FPS 或渲染模式。Godot 4.7 使用 `physics_process/process`、`RenderingServer` 与本代 `MainFrameTime`；本课依据静态源码，尚未运行。

## 下一课

继续阅读 [s06_scene_tree_iteration](../s06_scene_tree_iteration/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
