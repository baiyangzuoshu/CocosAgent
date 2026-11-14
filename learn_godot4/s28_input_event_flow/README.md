# 第 28 课：平台事件到 InputEvent 的构造路径

**目标：** 基于 `godot-4.7`（4.7.3-rc）追踪本课 C++ 路径，并用一个独立 Godot/GDScript 项目观察公开行为。

## 本课问题

平台按键事件在哪一层被转换成 Godot InputEvent？该事件经过哪个入口进入引擎输入处理？

## 本课增量

平台层把窗口系统事件转换或包装为引擎 InputEvent，再交给 Input::parse_input_event。G1/2 是按值传递的结构体风格；G3/4 使用 Ref<InputEvent> 对象。

## C++ 源码追踪

```text
DisplayServerMacOS event handler → Input::parse_input_event → Input state and Viewport route
```

native event → OS.push_input / DisplayServer event handler → Input::parse_input_event → Input state/event dispatch。

按 README 中表格顺序阅读完整源码副本。行号对应 `godot-4.7` 本地上游快照；每个 `.excerpt` 只保留本课所需的完整函数，其余上下文可在同目录完整源文件中查看。

## 本课源码复刻

`src/upstream/` 保留本课涉及的完整上游文件副本，按 Godot 原目录组织；文件逐字节来自 `engine/godot-4.7/`，不包含本课改写。函数摘录带原始行号，方便和完整文件互相核对。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 顺序 | 完整 C++ 源码 | 函数摘录 | 上游文件与行段 |
| --- | --- | --- | --- |
| 1 | [display_server_macos.mm](src/upstream/platform/macos/display_server_macos.mm) | [摘录](src/upstream/platform/macos/display_server_macos.mm.excerpt) | `engine/godot-4.7/platform/macos/display_server_macos.mm:504-507, 641-680` |
| 2 | [input.cpp](src/upstream/core/input/input.cpp) | [摘录](src/upstream/core/input/input.cpp.excerpt) | `engine/godot-4.7/core/input/input.cpp:1519-1558` |

## 最小 Godot/GDScript 实验

在运行窗口按空格，查看脚本回调收到的事件对象/结构体字段。不同平台的原生键码映射可能不同。

- 项目脚本：[`probe.gd`](probe.gd)
- 启动场景：[`main.tscn`](main.tscn)
- 资源夹具：[`payload.tscn`](payload.tscn)

## 运行与预期观察

在本课目录使用与项目格式匹配的 Godot 程序运行：

```sh
godot --path .
```

预期观察：在窗口里按空格，脚本打印本代事件类型、按键码和 pressed 状态。

本课只按源码静态追踪并整理预期结果；若未另外记录运行日志，不把预期观察写成已验证结果。

## 简化与边界

课程以 macOS 输入桥接代码为静态示例，事件结构和键码映射会随平台不同。实验观察的是本机窗口产生的事件。

## 下一课

继续阅读 [s29_input_map](../s29_input_map/README.md)。
