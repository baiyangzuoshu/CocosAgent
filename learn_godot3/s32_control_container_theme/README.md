# 第 32 课：锚点、Container 布局和 Theme 属性

**源码版本：** `godot-3.6`（3.6.4-rc）。本课按对应快照追踪 C++，再用独立 Godot/GDScript 工程对照可观察行为。

## 本课问题

自定义最小尺寸如何向父容器传播？Container 何时重新布局，Theme 变化又如何通知控件？

## 本课增量

把最小尺寸失效、Container 延迟排序和 Theme 变更通知放到同一条 UI 更新链上。

## C++ 源码追踪

```text
Control minimum-size cache → Container::queue_sort → _sort_children → Theme.set_theme_item notification
```

从左到右逐层记录参数在哪一层转换、状态在哪一层更新、何处调用下一层。链尾结论只依据本课列出的版本源码，不跨版本外推。

- `scene/gui/control.cpp:189-205` **`Control::_update_minimum_size_cache`**：重算并缓存最小尺寸，观察缓存失效与向父级通知的条件。
- `scene/gui/control.cpp:1257-1291` **`Control::set_anchor`**：锚点写入及 Control 尺寸变化时锚点/offset 的换算边界。
- `scene/gui/container.cpp:134-145` **`Container::queue_sort`**：合并重复布局请求并把实际容器排序延后到安全时机。
- `scene/gui/container.cpp:85-93` **`Container::_sort_children`**：按容器策略计算子控件位置和尺寸的实际布局循环。
- `scene/resources/theme.cpp:839-874` **`Theme::set_theme_item`**：Theme 项替换后如何通知使用者并使缓存失效。

## 本课源码复刻

`src/upstream/` 按引擎原目录保存本课涉及的完整上游文件副本；`.excerpt` 保留所列原始行号函数摘录。副本逐字节对应 `engine/godot-3.6/`，SHA-256 清单可核验。优先从摘录读关键分支，再打开完整文件检查调用方和成员状态。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 阅读顺序 | 完整上游源码 | 函数摘录 | 快照行号 |
| --- | --- | --- | --- |
| 1 | [control.cpp](src/upstream/scene/gui/control.cpp) | [摘录 189-205, 1257-1291](src/upstream/scene/gui/control.cpp.excerpt) | `engine/godot-3.6/scene/gui/control.cpp:189-205, 1257-1291` |
| 2 | [container.cpp](src/upstream/scene/gui/container.cpp) | [摘录 85-93, 134-145](src/upstream/scene/gui/container.cpp.excerpt) | `engine/godot-3.6/scene/gui/container.cpp:85-93, 134-145` |
| 3 | [theme.cpp](src/upstream/scene/resources/theme.cpp) | [摘录 839-874](src/upstream/scene/resources/theme.cpp.excerpt) | `engine/godot-3.6/scene/resources/theme.cpp:839-874` |

校验和源码文件清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

## GDScript 源码复刻

`src/source_replay.gd` 用本代脚本基类和字段复刻这条链中的关键状态变化：最小尺寸缓存、延迟 queue_sort、子项排序与 Theme dirty。模型不调用引擎私有 C++，只供逐步对照上方函数。

| GDScript 函数 | 对照步骤 |
| --- | --- |
| `_update_minimum_size_cache()` | 合并子控件最小尺寸并缓存结果。 |
| `_queue_sort()` | 合并布局请求，标记延迟排序。 |
| `_sort_children()` | 消费一次排序请求并放置子项。 |
| `_theme_changed()` | 模拟 Theme 项变化触发控件刷新。 |

## 最小 Godot/GDScript 实验

**实验：Container 最小尺寸和主题布局。** 把两个 Button 放进有明确位置和尺寸的 HBoxContainer，给第一个设置自定义最小尺寸；观察子项分配结果，修改容器尺寸后重新运行比较布局。



- 项目入口：[`main.tscn`](main.tscn)
- 探针脚本：[`probe.gd`](probe.gd)
- 模型脚本：[`src/source_replay.gd`](src/source_replay.gd)


## 运行与观察

在本课目录使用与工程格式匹配的 Godot 程序启动：

```sh
godot --path .
```

**预期观察：** 模型输出尺寸传播和排序请求；运行时 HBoxContainer 会按子项最小尺寸分配水平空间。修改探针中的容器尺寸再运行，可比较子项布局变化。

**动手改一处：** 按实验主题修改一个输入、尺寸、变换、材质或可见性参数；先预测状态/输出，再沿上方 C++ 链找出负责更新的函数。

## 简化与边界

模型只计算最小尺寸传播与一次排序请求；真实布局还受 anchors/offsets、size flags、容器类型、主题继承和字体度量影响。

GDScript 教学模型只模拟状态传递，不是 C++ 的逐行翻译，也不执行引擎内部线程或 GPU 工作。

## 下一课

继续阅读 [s33_window_viewport_coordinates](../s33_window_viewport_coordinates/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
