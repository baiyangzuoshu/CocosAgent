# 第 27 课：平台输入事件如何进入 Input

**目标：** 基于 `godot-1.1`（1.1 stable）追踪本课 C++ 路径，并用一个独立 Godot/GDScript 项目观察公开行为。

## 本课问题

macOS 平台层收到 InputEvent 后，在哪一层补充事件标识并交给 InputDefault？脚本的 _input 接收的是哪种旧版事件结构？

## 本课增量

Godot 1.1 的平台适配层将按值传递的 InputEvent 交给 InputDefault；InputDefault 更新状态后再进入 SceneTree/Viewport 输入路由。

## C++ 源码追踪

```text
OS_OSX::push_input(InputEvent) → InputDefault::parse_input_event → SceneTree/Viewport routing
```

本课选 macOS push_input 作为一个具体平台入口。OS 层复制事件并分配 ID；InputDefault 再更新按键、鼠标和动作状态。

按 README 中表格顺序阅读完整源码副本。行号对应 `godot-1.1` 本地上游快照；每个 `.excerpt` 只保留本课所需的完整函数，其余上下文可在同目录完整源文件中查看。

## 本课源码复刻

`src/upstream/` 保留本课涉及的完整上游文件副本，按 Godot 原目录组织；文件逐字节来自 `engine/godot-1.1/`，不包含本课改写。函数摘录带原始行号，方便和完整文件互相核对。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 顺序 | 完整 C++ 源码 | 函数摘录 | 上游文件与行段 |
| --- | --- | --- | --- |
| 1 | [os_osx.mm](src/upstream/platform/osx/os_osx.mm) | [摘录](src/upstream/platform/osx/os_osx.mm.excerpt) | `engine/godot-1.1/platform/osx/os_osx.mm:1505-1511` |
| 2 | [input.cpp](src/upstream/core/os/input.cpp) | [摘录](src/upstream/core/os/input.cpp.excerpt) | `engine/godot-1.1/core/os/input.cpp:246-293` |

## 最小 Godot/GDScript 实验

在运行窗口按空格，查看脚本回调收到的事件对象/结构体字段。不同平台的原生键码映射可能不同。

- 项目脚本：[`probe.gd`](probe.gd)
- 启动场景：`main.xml`（Godot 1.1）
- 资源夹具：`payload.xml`（Godot 1.1）

## 运行与预期观察

在本课目录使用与项目格式匹配的 Godot 程序运行：

```sh
godot -path .
```

预期观察：按键按下/抬起分别产生事件；scancode 由本机键盘布局和平台映射决定。

本课只按源码静态追踪并整理预期结果；若未另外记录运行日志，不把预期观察写成已验证结果。

## 简化与边界

课程以 macOS 输入桥接代码为静态示例，事件结构和键码映射会随平台不同。实验观察的是本机窗口产生的事件。

## 下一课

继续阅读 [s28_input_map](../s28_input_map/README.md)。
