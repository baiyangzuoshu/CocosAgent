# 第 33 课：Window、Viewport 与屏幕坐标关系

**源码版本：** `godot-3.6`（3.6.4-rc）。本课按对应快照追踪 C++，再用独立 Godot/GDScript 工程对照可观察行为。

## 本课问题

屏幕/窗口坐标怎样经过 stretch、Viewport 与 canvas transform 变成本地输入坐标？

## 本课增量

把 OS 窗口位置、Viewport stretch 和 canvas transform 分层，逐步计算输入局部坐标。

## C++ 源码追踪

```text
Viewport::_make_input_local → canvas transform inverse → local InputEvent; OS window remains outside scene tree
```

从左到右逐层记录参数在哪一层转换、状态在哪一层更新、何处调用下一层。链尾结论只依据本课列出的版本源码，不跨版本外推。

- `scene/main/viewport.cpp:1403-1411` **`Viewport::_make_input_local`**：复制或调整 InputEvent 的位置，使回调看到当前 Viewport 坐标。
- `scene/main/viewport.cpp:844-850` **`Viewport::set_canvas_transform`**：设置 2D canvas transform 后触发画布与输入坐标更新。
- `scene/main/viewport.cpp:852-854` **`Viewport::get_canvas_transform`**：返回当前 canvas transform，供实验打印并核对逆变换来源。

## 本课源码复刻

`src/upstream/` 按引擎原目录保存本课涉及的完整上游文件副本；`.excerpt` 保留所列原始行号函数摘录。副本逐字节对应 `engine/godot-3.6/`，SHA-256 清单可核验。优先从摘录读关键分支，再打开完整文件检查调用方和成员状态。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 阅读顺序 | 完整上游源码 | 函数摘录 | 快照行号 |
| --- | --- | --- | --- |
| 1 | [viewport.cpp](src/upstream/scene/main/viewport.cpp) | [摘录 844-850, 852-854, 1403-1411](src/upstream/scene/main/viewport.cpp.excerpt) | `engine/godot-3.6/scene/main/viewport.cpp:844-850, 852-854, 1403-1411` |

校验和源码文件清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

## GDScript 源码复刻

`src/source_replay.gd` 用本代脚本基类和字段复刻这条链中的关键状态变化：stretch 局部坐标、Viewport 输入复制和 canvas 逆变换。模型不调用引擎私有 C++，只供逐步对照上方函数。

| GDScript 函数 | 对照步骤 |
| --- | --- |
| `_update_stretch_transform()` | 把屏幕位置缩放到 Viewport 空间。 |
| `_make_input_local()` | 构造当前 Viewport 使用的局部事件坐标。 |
| `_apply_canvas_transform()` | 应用画布逆变换得到绘制空间坐标。 |

## 最小 Godot/GDScript 实验

**实验：Viewport 输入与画布坐标。** 记录根 Viewport 的 canvas transform 和鼠标事件；修改 stretch 或画布变换后再次点击，对比输入位置。



- 项目入口：[`main.tscn`](main.tscn)
- 探针脚本：[`probe.gd`](probe.gd)
- 模型脚本：[`src/source_replay.gd`](src/source_replay.gd)


## 运行与观察

在本课目录使用与工程格式匹配的 Godot 程序启动：

```sh
godot --path .
```

**预期观察：** 启动后先打印 GDScript 模型中的状态转移，再执行本课公开 API 实验。模型打印用于检查调用顺序；只有引擎实际运行并留下日志后，才能把预期观察记为运行验证。

**动手改一处：** 按实验主题修改一个输入、尺寸、变换、材质或可见性参数；先预测状态/输出，再沿上方 C++ 链找出负责更新的函数。

## 简化与边界

模型只使用二维缩放与平移展示坐标逆变换；不模拟 DPI、旋转窗口、多屏、SubViewport 嵌套或 stretch 的全部策略。

GDScript 教学模型只模拟状态传递，不是 C++ 的逐行翻译，也不执行引擎内部线程或 GPU 工作。

## 下一课

继续阅读 [s34_visual_server_rid](../s34_visual_server_rid/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
