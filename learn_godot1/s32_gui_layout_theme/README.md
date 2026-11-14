# 第 32 课：锚点、容器布局、主题和最小尺寸

**源码版本：** `godot-1.1`（1.1 stable）。本课按对应快照追踪 C++，再用独立 Godot/GDScript 工程对照可观察行为。

## 本课问题

自定义最小尺寸如何向父容器传播？Container 何时重新布局，Theme 变化又如何通知控件？

## 本课增量

把最小尺寸失效、Container 延迟排序和 Theme 变更通知放到同一条 UI 更新链上。

## C++ 源码追踪

```text
Control::_update_minimum_size → minimum_size_changed → Container::queue_sort → _sort_children → Theme changed
```

从左到右逐层记录参数在哪一层转换、状态在哪一层更新、何处调用下一层。链尾结论只依据本课列出的版本源码，不跨版本外推。

- `scene/gui/control.cpp:194-209` **`Control::_update_minimum_size`**：合并控件自定义/主题等最小尺寸来源，并触发父布局失效。
- `scene/gui/control.cpp:1658-1709` **`Control::_size_changed`**：尺寸改变后通知子控件、Container 和布局相关状态。
- `scene/gui/container.cpp:102-112` **`Container::queue_sort`**：合并重复布局请求并把实际容器排序延后到安全时机。
- `scene/gui/container.cpp:68-76` **`Container::_sort_children`**：按容器策略计算子控件位置和尺寸的实际布局循环。
- `scene/resources/theme.cpp:273-285` **`Theme::set_stylebox`**：主题样式资源更新、主题项查找与控件通知。

## 本课源码复刻

`src/upstream/` 按引擎原目录保存本课涉及的完整上游文件副本；`.excerpt` 保留所列原始行号函数摘录。副本逐字节对应 `engine/godot-1.1/`，SHA-256 清单可核验。优先从摘录读关键分支，再打开完整文件检查调用方和成员状态。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 阅读顺序 | 完整上游源码 | 函数摘录 | 快照行号 |
| --- | --- | --- | --- |
| 1 | [control.cpp](src/upstream/scene/gui/control.cpp) | [摘录 194-209, 1658-1709](src/upstream/scene/gui/control.cpp.excerpt) | `engine/godot-1.1/scene/gui/control.cpp:194-209, 1658-1709` |
| 2 | [container.cpp](src/upstream/scene/gui/container.cpp) | [摘录 68-76, 102-112](src/upstream/scene/gui/container.cpp.excerpt) | `engine/godot-1.1/scene/gui/container.cpp:68-76, 102-112` |
| 3 | [theme.cpp](src/upstream/scene/resources/theme.cpp) | [摘录 273-285](src/upstream/scene/resources/theme.cpp.excerpt) | `engine/godot-1.1/scene/resources/theme.cpp:273-285` |

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

**实验：Container 最小尺寸和主题布局。** 把两个 Button 放进 HBoxContainer，给第一个设置最小尺寸；调整窗口并观察 Container 重排子项。



- 项目入口：[`main.xml`](main.xml)
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

模型只计算最小尺寸传播与一次排序请求；真实布局还受 anchors/offsets、size flags、容器类型、主题继承和字体度量影响。

GDScript 教学模型只模拟状态传递，不是 C++ 的逐行翻译，也不执行引擎内部线程或 GPU 工作。

## 下一课

继续阅读 [s33_visual_server_interface](../s33_visual_server_interface/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
