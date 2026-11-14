# 第 29 课：Node 输入与未处理输入分发

**目标：** 基于 `godot-1.1`（1.1 stable）追踪本课 C++ 路径，并用一个独立 Godot/GDScript 项目观察公开行为。

## 本课问题

Viewport 通过哪些输入组调用 Node._input 和 Node._unhandled_input？set_input_as_handled 如何截断后一阶段？

## 本课增量

Node 注册输入回调时加入对应 Viewport 的处理组；Viewport 在输入阶段与未处理阶段分别遍历这些组。

## C++ 源码追踪

```text
Node::set_process_input / set_process_unhandled_input → Viewport input groups → script callbacks
```

先看 Node::set_process_input/unhandled_input 如何更新组，再看 Viewport::input/unhandled_input 如何调用组回调。SceneTree 的 handled 状态决定是否进入未处理阶段。

按 README 中表格顺序阅读完整源码副本。行号对应 `godot-1.1` 本地上游快照；每个 `.excerpt` 只保留本课所需的完整函数，其余上下文可在同目录完整源文件中查看。

## 本课源码复刻

`src/upstream/` 保留本课涉及的完整上游文件副本，按 Godot 原目录组织；文件逐字节来自 `engine/godot-1.1/`，不包含本课改写。函数摘录带原始行号，方便和完整文件互相核对。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 顺序 | 完整 C++ 源码 | 函数摘录 | 上游文件与行段 |
| --- | --- | --- | --- |
| 1 | [node.cpp](src/upstream/scene/main/node.cpp) | [摘录](src/upstream/scene/main/node.cpp.excerpt) | `engine/godot-1.1/scene/main/node.cpp:451-466, 472-484` |
| 2 | [viewport.cpp](src/upstream/scene/main/viewport.cpp) | [摘录](src/upstream/scene/main/viewport.cpp.excerpt) | `engine/godot-1.1/scene/main/viewport.cpp:1191-1196, 1198-1217` |

## 最小 Godot/GDScript 实验

按空格观察 _input 与 _unhandled_input 两阶段；按 Escape，脚本在 _input 标记 handled，观察后续分发被截断。

- 项目脚本：[`probe.gd`](probe.gd)
- 启动场景：`main.xml`（Godot 1.1）
- 资源夹具：`payload.xml`（Godot 1.1）

## 运行与预期观察

在本课目录使用与项目格式匹配的 Godot 程序运行：

```sh
godot -path .
```

预期观察：空格会打印 input 和 unhandled 两行；Escape 会打印 handled 标记而没有 unhandled 行。

本课只按源码静态追踪并整理预期结果；若未另外记录运行日志，不把预期观察写成已验证结果。

## 简化与边界

只观察根 Viewport 的常见路径，不包含 Control 命中、焦点、SubViewport 转发、拖拽捕获和多窗口路由。Godot 4 增加 shortcut/unhandled-key 阶段。

## 下一课

继续阅读 [s30_viewport_input](../s30_viewport_input/README.md)。
