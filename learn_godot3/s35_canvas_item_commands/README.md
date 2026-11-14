# 第 35 课：CanvasItem 命令缓存和绘制提交

**源码版本：** `godot-3.6`（3.6.4-rc）。本课按对应快照追踪 C++，再用独立 Godot/GDScript 工程对照可观察行为。

## 本课问题

GDScript 的 draw_* 调用如何变成 CanvasItem 命令？为什么绘制只允许发生在 draw 阶段？

## 本课增量

从脚本 draw_* 入口追到 CanvasItem 的服务器命令；标出 draw 通知边界和 redraw 请求。

## C++ 源码追踪

```text
CanvasItem::update → NOTIFICATION_DRAW / draw_rect → VisualServerCanvas::canvas_item_add_rect
```

从左到右逐层记录参数在哪一层转换、状态在哪一层更新、何处调用下一层。链尾结论只依据本课列出的版本源码，不跨版本外推。

- `scene/2d/canvas_item.cpp:665-676` **`CanvasItem::update`**：请求 CanvasItem 在后续 draw 通知中重建命令。
- `scene/2d/canvas_item.cpp:815-867` **`CanvasItem::draw_rect`**：把矩形参数写为 CanvasItem draw 命令，而不是立刻直接执行 GPU 绘制。
- `servers/visual/visual_server_canvas.cpp:1201-1213` **`VisualServerCanvas::canvas_item_add_rect`**：Renderer 收到矩形命令并更新画布项 command list。

## 本课源码复刻

`src/upstream/` 按引擎原目录保存本课涉及的完整上游文件副本；`.excerpt` 保留所列原始行号函数摘录。副本逐字节对应 `engine/godot-3.6/`，SHA-256 清单可核验。优先从摘录读关键分支，再打开完整文件检查调用方和成员状态。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 阅读顺序 | 完整上游源码 | 函数摘录 | 快照行号 |
| --- | --- | --- | --- |
| 1 | [canvas_item.cpp](src/upstream/scene/2d/canvas_item.cpp) | [摘录 665-676, 815-867](src/upstream/scene/2d/canvas_item.cpp.excerpt) | `engine/godot-3.6/scene/2d/canvas_item.cpp:665-676, 815-867` |
| 2 | [visual_server_canvas.cpp](src/upstream/servers/visual/visual_server_canvas.cpp) | [摘录 1201-1213](src/upstream/servers/visual/visual_server_canvas.cpp.excerpt) | `engine/godot-3.6/servers/visual/visual_server_canvas.cpp:1201-1213` |

校验和源码文件清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

## GDScript 源码复刻

`src/source_replay.gd` 用本代脚本基类和字段复刻这条链中的关键状态变化：redraw 请求、draw 回调内命令记录和服务器命令提交。模型不调用引擎私有 C++，只供逐步对照上方函数。

| GDScript 函数 | 对照步骤 |
| --- | --- |
| `_queue_redraw()` | 请求稍后产生新 draw 命令。 |
| `_draw_rect()` | 在 draw 阶段写入矩形命令数据。 |
| `_submit_command()` | 把命令交给模型中的服务器边界。 |

## 最小 Godot/GDScript 实验

**实验：CanvasItem 绘制命令。** 让 Node2D 在绘制回调内提交重叠矩形，沿脚本 draw_*、NOTIFICATION_DRAW 和服务器命令顺序阅读。



- 项目入口：[`main.tscn`](main.tscn)
- 探针脚本：[`probe.gd`](probe.gd)
- 模型脚本：[`src/source_replay.gd`](src/source_replay.gd)
- 绘制探针：[`draw_probe.gd`](draw_probe.gd)

## 运行与观察

在本课目录使用与工程格式匹配的 Godot 程序启动：

```sh
godot --path .
```

**预期观察：** 启动后先打印 GDScript 模型中的状态转移，再执行本课公开 API 实验。模型打印用于检查调用顺序；只有引擎实际运行并留下日志后，才能把预期观察记为运行验证。

**动手改一处：** 按实验主题修改一个输入、尺寸、变换、材质或可见性参数；先预测状态/输出，再沿上方 C++ 链找出负责更新的函数。

## 简化与边界

模型只记录矩形命令，不执行服务器、shader、clip、纹理、抗锯齿或 GPU 绘制。

GDScript 教学模型只模拟状态传递，不是 C++ 的逐行翻译，也不执行引擎内部线程或 GPU 工作。

## 下一课

继续阅读 [s36_canvas_2d_render](../s36_canvas_2d_render/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
