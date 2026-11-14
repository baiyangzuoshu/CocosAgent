# 第 32 课：Control 命中、焦点导航与 GUI 事件

**源码版本：** `godot-2.1`（2.1.7-rc）。本课按对应快照追踪 C++，再用独立 Godot/GDScript 工程对照可观察行为。

## 本课问题

Control 如何取得焦点、按方向键寻找下一个焦点目标，并消费 GUI 事件？

## 本课增量

把焦点模式、焦点拥有者和方向键导航连成 Control 状态链。

## C++ 源码追踪

```text
Control focus_mode → grab_focus / find_next_valid_focus → GUI event acceptance
```

从左到右逐层记录参数在哪一层转换、状态在哪一层更新、何处调用下一层。链尾结论只依据本课列出的版本源码，不跨版本外推。

- `scene/gui/control.cpp:1500-1506` **`Control::set_focus_mode`**：焦点模式变化对焦点候选资格及既有焦点状态的影响。
- `scene/gui/control.cpp:1678-1687` **`Control::grab_focus`**：将 Control 设为当前焦点拥有者，并通知旧/新焦点控件。
- `scene/gui/control.cpp:1689-1698` **`Control::release_focus`**：释放焦点拥有权并触发对应焦点状态更新。
- `scene/gui/control.cpp:1535-1595` **`Control::find_next_valid_focus`**：根据遍历顺序寻找下一个允许接收焦点的 Control。
- `scene/gui/control.cpp:1617-1667` **`Control::find_prev_valid_focus`**：根据反向遍历顺序寻找上一个允许接收焦点的 Control。

## 本课源码复刻

`src/upstream/` 按引擎原目录保存本课涉及的完整上游文件副本；`.excerpt` 保留所列原始行号函数摘录。副本逐字节对应 `engine/godot-2.1/`，SHA-256 清单可核验。优先从摘录读关键分支，再打开完整文件检查调用方和成员状态。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 阅读顺序 | 完整上游源码 | 函数摘录 | 快照行号 |
| --- | --- | --- | --- |
| 1 | [control.cpp](src/upstream/scene/gui/control.cpp) | [摘录 1500-1506, 1535-1595, 1617-1667, 1678-1687, 1689-1698](src/upstream/scene/gui/control.cpp.excerpt) | `engine/godot-2.1/scene/gui/control.cpp:1500-1506, 1535-1595, 1617-1667, 1678-1687, 1689-1698` |

校验和源码文件清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

## GDScript 源码复刻

`src/source_replay.gd` 用本代脚本基类和字段复刻这条链中的关键状态变化：焦点模式、焦点拥有者、导航目标和事件消费。模型不调用引擎私有 C++，只供逐步对照上方函数。

| GDScript 函数 | 对照步骤 |
| --- | --- |
| `_set_focus_mode()` | 把 Control 标记为可参与焦点导航。 |
| `_grab_focus()` | 把焦点拥有者设置为第一个控件。 |
| `_move_focus()` | 模拟导航到下一个有效控件。 |
| `_dispatch_gui_event()` | 在当前焦点目标触发一次 GUI 输入。 |
| `_accept_event()` | 消费事件并阻止后续未处理阶段。 |

## 最小 Godot/GDScript 实验

**实验：Control 焦点导航。** 创建两个可聚焦 Button 并把焦点交给第一个，按 Tab/方向键观察焦点目标转移。



- 项目入口：[`main.tscn`](main.tscn)
- 探针脚本：[`probe.gd`](probe.gd)
- 模型脚本：[`src/source_replay.gd`](src/source_replay.gd)


## 运行与观察

在本课目录使用与工程格式匹配的 Godot 程序启动：

```sh
godot -path .
```

**预期观察：** 启动后先打印 GDScript 模型中的状态转移，再执行本课公开 API 实验。模型打印用于检查调用顺序；只有引擎实际运行并留下日志后，才能把预期观察记为运行验证。

**动手改一处：** 按实验主题修改一个输入、尺寸、变换、材质或可见性参数；先预测状态/输出，再沿上方 C++ 链找出负责更新的函数。

## 简化与边界

模型只模拟两个焦点候选和一次焦点转移；不覆盖弹窗焦点恢复、鼠标捕获和所有导航规则。

GDScript 教学模型只模拟状态传递，不是 C++ 的逐行翻译，也不执行引擎内部线程或 GPU 工作。

## 下一课

继续阅读 [s33_gui_layout_theme](../s33_gui_layout_theme/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
