# 第 29 课：InputMap 动作映射与输入状态

**目标：** 基于 `godot-3.6`（3.6.4-rc）追踪本课 C++ 路径，并用一个独立 Godot/GDScript 项目观察公开行为。

## 本课问题

动作名如何映射到事件列表？事件匹配与 Input.is_action_pressed 查询的时机有什么不同？

## 本课增量

InputMap 将动作名称映射到一组 InputEvent。事件匹配、动作强度和 Input 状态查询是不同步骤；动作表本身不会替代事件分发。

## C++ 源码追踪

```text
InputMap action list → event_is_action → Input.is_action_pressed and strength queries
```

InputMap.action_add_event → action event list → event_is_action / Input.is_action_pressed。

按 README 中表格顺序阅读完整源码副本。行号对应 `godot-3.6` 本地上游快照；每个 `.excerpt` 只保留本课所需的完整函数，其余上下文可在同目录完整源文件中查看。

## 本课源码复刻

`src/upstream/` 保留本课涉及的完整上游文件副本，按 Godot 原目录组织；文件逐字节来自 `engine/godot-3.6/`，不包含本课改写。函数摘录带原始行号，方便和完整文件互相核对。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 顺序 | 完整 C++ 源码 | 函数摘录 | 上游文件与行段 |
| --- | --- | --- | --- |
| 1 | [input_map.cpp](src/upstream/core/input_map.cpp) | [摘录](src/upstream/core/input_map.cpp.excerpt) | `engine/godot-3.6/core/input_map.cpp:164-173, 220-222` |

## 最小 Godot/GDScript 实验

运行时把 ui_accept 的现有事件列表复制到 s29_confirm；按空格观察 event_is_action。这个动作只存在于当前进程。

- 项目脚本：[`probe.gd`](probe.gd)
- 启动场景：[`main.tscn`](main.tscn)
- 资源夹具：[`payload.tscn`](payload.tscn)

## 运行与预期观察

在本课目录使用与项目格式匹配的 Godot 程序运行：

```sh
godot --path .
```

预期观察：复制 ui_accept 的绑定到课内临时动作，按空格观察事件是否匹配；动作仅在运行时添加，不写回项目设置。

本课只按源码静态追踪并整理预期结果；若未另外记录运行日志，不把预期观察写成已验证结果。

## 简化与边界

实验复制默认 ui_accept 绑定作为进程内样例；它不修改 ProjectSettings，也不覆盖键盘布局、设备编号和 dead-zone 语义。

## 下一课

继续阅读 [s30_viewport_input_dispatch](../s30_viewport_input_dispatch/README.md)。
