# 第 31 课：Control 命中测试、焦点与 GUI 输入

**源码版本：** `godot-3.6`（3.6.4-rc）。本课按对应快照追踪 C++，再用独立 Godot/GDScript 工程对照可观察行为。

## 本课问题

Viewport 如何从一组 Control 中选出鼠标目标？焦点如何更新，Control 如何消费 GUI 事件并停止后续处理？

## 本课增量

把命中候选、Control 焦点和 handled 状态连成一个输入路由；保留本代信号/虚方法差异。

## C++ 源码追踪

```text
Viewport::_gui_find_control_at_pos → _gui_input_event → Control.gui_input / _gui_input → accept_event
```

从左到右逐层记录参数在哪一层转换、状态在哪一层更新、何处调用下一层。链尾结论只依据本课列出的版本源码，不跨版本外推。

- `scene/main/viewport.cpp:1779-1833` **`Viewport::_gui_find_control_at_pos`**：从 Viewport 的 GUI 根节点查找最前方可接收事件的 Control。
- `scene/main/viewport.cpp:1867-2523` **`Viewport::_gui_input_event`**：GUI 阶段的命中、焦点转移、控件回调及 handled 检查。
- `scene/gui/control.cpp:2170-2174` **`Control::accept_event`**：将当前 GUI 事件标记为已消费，使 Viewport 停止后续输入阶段。
- `scene/gui/control.cpp:1834-1842` **`Control::set_focus_mode`**：焦点模式变化对焦点候选资格及既有焦点状态的影响。

## 本课源码复刻

`src/upstream/` 按引擎原目录保存本课涉及的完整上游文件副本；`.excerpt` 保留所列原始行号函数摘录。副本逐字节对应 `engine/godot-3.6/`，SHA-256 清单可核验。优先从摘录读关键分支，再打开完整文件检查调用方和成员状态。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 阅读顺序 | 完整上游源码 | 函数摘录 | 快照行号 |
| --- | --- | --- | --- |
| 1 | [viewport.cpp](src/upstream/scene/main/viewport.cpp) | [摘录 1779-1833, 1867-2523](src/upstream/scene/main/viewport.cpp.excerpt) | `engine/godot-3.6/scene/main/viewport.cpp:1779-1833, 1867-2523` |
| 2 | [control.cpp](src/upstream/scene/gui/control.cpp) | [摘录 1834-1842, 2170-2174](src/upstream/scene/gui/control.cpp.excerpt) | `engine/godot-3.6/scene/gui/control.cpp:1834-1842, 2170-2174` |

校验和源码文件清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

## GDScript 源码复刻

`src/source_replay.gd` 用本代脚本基类和字段复刻这条链中的关键状态变化：命中候选、焦点写入、GUI 分发与 handled 截断。模型不调用引擎私有 C++，只供逐步对照上方函数。

| GDScript 函数 | 对照步骤 |
| --- | --- |
| `_find_control_at_pos()` | 扫描候选 Control 并返回命中目标。 |
| `_update_focus()` | 把焦点目标写入模型状态。 |
| `_dispatch_gui_event()` | 进入控件 GUI 输入回调并初始化 handled。 |
| `_accept_event()` | 消费事件并截断后续阶段。 |

## 最小 Godot/GDScript 实验

**实验：Control 命中、焦点与 GUI 输入。** 创建两个可聚焦 Button，点击分别观察 pressed 回调，按 Tab 在两个控件间切换焦点；源码模型单独打印模拟命中目标与 handled 状态。



- 项目入口：[`main.tscn`](main.tscn)
- 探针脚本：[`probe.gd`](probe.gd)
- 模型脚本：[`src/source_replay.gd`](src/source_replay.gd)


## 运行与观察

在本课目录使用与工程格式匹配的 Godot 程序启动：

```sh
godot --path .
```

**预期观察：** 模型先打印 hit-test → focus → GUI dispatch → accept_event，并输出模拟目标与 handled 状态。运行时窗口提供两个按钮；点击可看到对应回调，按 Tab 可在两个焦点目标间切换。

**动手改一处：** 按实验主题修改一个输入、尺寸、变换、材质或可见性参数；先预测状态/输出，再沿上方 C++ 链找出负责更新的函数。

## 简化与边界

模型只保留一个可见 Button、一个 Panel 和一个焦点目标；没有复刻鼠标捕获、拖拽、弹窗、触控或所有 Control 的优先级规则。

GDScript 教学模型只模拟状态传递，不是 C++ 的逐行翻译，也不执行引擎内部线程或 GPU 工作。

## 下一课

继续阅读 [s32_control_container_theme](../s32_control_container_theme/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
