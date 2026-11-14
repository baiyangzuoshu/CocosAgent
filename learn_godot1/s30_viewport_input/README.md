# 第 30 课：Viewport 输入路由与局部坐标

**目标：** 基于 `godot-1.1`（1.1 stable）追踪本课 C++ 路径，并用一个独立 Godot/GDScript 项目观察公开行为。

## 本课问题

Viewport 收到鼠标位置后，如何按 viewport transform 把位置转换为本地坐标？局部事件由哪个输入回调接收？

## 本课增量

Viewport 复制输入事件，再用 viewport 的逆变换调整鼠标坐标；转换后的事件进入该 Viewport 的 Node 输入组。

## C++ 源码追踪

```text
OS event → Viewport::_make_input_local → Viewport::_vp_input → Viewport::input → Node._input(local_event)
```

对照 _make_input_local 中鼠标按钮/移动坐标的变换，再看 _vp_input 复制事件并调用 input。转换使用 Viewport 变换，不是简单减去窗口左上角。

按 README 中表格顺序阅读完整源码副本。行号对应 `godot-1.1` 本地上游快照；每个 `.excerpt` 只保留本课所需的完整函数，其余上下文可在同目录完整源文件中查看。

## 本课源码复刻

`src/upstream/` 保留本课涉及的完整上游文件副本，按 Godot 原目录组织；文件逐字节来自 `engine/godot-1.1/`，不包含本课改写。函数摘录带原始行号，方便和完整文件互相核对。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 顺序 | 完整 C++ 源码 | 函数摘录 | 上游文件与行段 |
| --- | --- | --- | --- |
| 1 | [viewport.cpp](src/upstream/scene/main/viewport.cpp) | [摘录](src/upstream/scene/main/viewport.cpp.excerpt) | `engine/godot-1.1/scene/main/viewport.cpp:1092-1148, 1151-1163, 1165-1178, 1191-1196, 1198-1217` |
| 2 | [scene_main_loop.cpp](src/upstream/scene/main/scene_main_loop.cpp) | [摘录](src/upstream/scene/main/scene_main_loop.cpp.excerpt) | `engine/godot-1.1/scene/main/scene_main_loop.cpp:336-463` |

## 最小 Godot/GDScript 实验

在窗口不同位置点击，打印脚本收到的鼠标坐标；在编辑器中给根 Viewport 加缩放后再次点击，比较局部坐标。

- 项目脚本：[`probe.gd`](probe.gd)
- 启动场景：`main.xml`（Godot 1.1）
- 资源夹具：`payload.xml`（Godot 1.1）

## 运行与预期观察

在本课目录使用与项目格式匹配的 Godot 程序运行：

```sh
godot -path .
```

预期观察：每次点击都会记录输入位置；Viewport 有变换时，回调坐标按本地画布坐标反映该变换。

本课只按源码静态追踪并整理预期结果；若未另外记录运行日志，不把预期观察写成已验证结果。

## 简化与边界

只观察根 Viewport 的鼠标局部坐标转换；不涵盖 Control 命中、多窗口、触控坐标和嵌套 Viewport 转发。窗口尺寸及 stretch 设置会影响变换。
