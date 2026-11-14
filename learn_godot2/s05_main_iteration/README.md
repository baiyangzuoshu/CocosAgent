# 第 5 课：`Main::iteration()` 的固定步进与帧绘制

**目标：** 追踪 Godot 2.1 `Main::iteration()` 如何累计经过时间、执行零次或多次固定更新，再调用 idle 并同步/绘制 `VisualServer`。

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

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [main.cpp](src/upstream/main/main.cpp) | [摘录](src/upstream/main/main.cpp.excerpt) | `engine/godot-2.1/main/main.cpp` | 1494-1520, 1523-1550 |
| 2 | [node.cpp](src/upstream/scene/main/node.cpp) | [摘录](src/upstream/scene/main/node.cpp.excerpt) | `engine/godot-2.1/scene/main/node.cpp` | 52-73 |

## 可运行源码复刻

课程代码 [`src/source_replay.gd`](src/source_replay.gd) 按本课 C++ 函数关系实现一个小型 GDScript 模型；入口脚本会先运行它，再执行下面的真实引擎 API 实验。阅读时把模型中的状态变化逐步映射到上方的 C++ 摘录。模型只复刻本课选出的路径，不声称等同于完整 Godot 引擎。

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
