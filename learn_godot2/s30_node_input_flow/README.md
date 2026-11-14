# 第 30 课：Node 输入、未处理输入与传播顺序

**目标：** 基于 `godot-2.1`（2.1.7-rc）追踪本课 C++ 路径，并用一个独立 Godot/GDScript 项目观察公开行为。

## 本课问题

Viewport 在何处调用 Node._input 和 Node._unhandled_input？事件标记 handled 后哪些阶段会停止？

## 本课增量

输入首先进入当前 Viewport。ViewPort 按阶段调用启用输入的节点；只有尚未标记 handled 的事件才进入未处理阶段。嵌套 viewport 还可能转换局部坐标。

## C++ 源码追踪

```text
SceneTree::input_event → Viewport::input → _input groups → handled flag → Viewport::unhandled_input
```

platform/Input → Viewport → Node._input → GUI phase → _unhandled_key_input（若版本支持）→ Node._unhandled_input；handled 会截断后续阶段。

按 README 中表格顺序阅读完整源码副本。行号对应 `godot-2.1` 本地上游快照；每个 `.excerpt` 只保留本课所需的完整函数，其余上下文可在同目录完整源文件中查看。

## 本课源码复刻

`src/upstream/` 保留本课涉及的完整上游文件副本，按 Godot 原目录组织；文件逐字节来自 `engine/godot-2.1/`，不包含本课改写。函数摘录带原始行号，方便和完整文件互相核对。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 顺序 | 完整 C++ 源码 | 函数摘录 | 上游文件与行段 |
| --- | --- | --- | --- |
| 1 | [scene_main_loop.cpp](src/upstream/scene/main/scene_main_loop.cpp) | [摘录](src/upstream/scene/main/scene_main_loop.cpp.excerpt) | `engine/godot-2.1/scene/main/scene_main_loop.cpp:336-459` |
| 2 | [node.cpp](src/upstream/scene/main/node.cpp) | [摘录](src/upstream/scene/main/node.cpp.excerpt) | `engine/godot-2.1/scene/main/node.cpp:468-481, 487-499` |
| 3 | [viewport.cpp](src/upstream/scene/main/viewport.cpp) | [摘录](src/upstream/scene/main/viewport.cpp.excerpt) | `engine/godot-2.1/scene/main/viewport.cpp:2271-2278, 2280-2297` |

## 最小 Godot/GDScript 实验

按空格观察 _input 与 _unhandled_input 两阶段；按 Escape，脚本在 _input 标记 handled，观察后续分发被截断。

- 项目脚本：[`probe.gd`](probe.gd)
- 启动场景：[`main.tscn`](main.tscn)
- 资源夹具：[`payload.tscn`](payload.tscn)

## 运行与预期观察

在本课目录使用与项目格式匹配的 Godot 程序运行：

```sh
godot -path .
```

预期观察：分别按空格和 Escape：空格应到达 input 与 unhandled 日志；Escape 在 _input 标记 handled，后续 unhandled 日志不应出现。

本课只按源码静态追踪并整理预期结果；若未另外记录运行日志，不把预期观察写成已验证结果。

## 简化与边界

只观察根 Viewport 的常见路径，不包含 Control 命中、焦点、SubViewport 转发、拖拽捕获和多窗口路由。Godot 4 增加 shortcut/unhandled-key 阶段。
