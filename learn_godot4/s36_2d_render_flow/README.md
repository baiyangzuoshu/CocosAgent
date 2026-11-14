# 第 36 课：2D 画布可见性、排序与绘制

**源码版本：** `godot-4.7`（4.7.3-rc）。本课按对应快照追踪 C++，再用独立 Godot/GDScript 工程对照可观察行为。

## 本课问题

CanvasItem 树怎样累计变换、裁剪和可见性，再按层级/深度组织绘制？

## 本课增量

从节点 CanvasItem 子树追到服务端绘制遍历、裁剪、排序与 viewport 提交。

## C++ 源码追踪

```text
RendererCanvasCull::_render_canvas_item_tree / _cull_canvas_item → RendererViewport::_draw_viewport
```

从左到右逐层记录参数在哪一层转换、状态在哪一层更新、何处调用下一层。链尾结论只依据本课列出的版本源码，不跨版本外推。

- `servers/rendering/renderer_canvas_cull.cpp:71-109` **`RendererCanvasCull::_render_canvas_item_tree`**：遍历 CanvasItem 子树并组织变换、裁剪和待绘制项目。
- `servers/rendering/renderer_canvas_cull.cpp:304-493` **`RendererCanvasCull::_cull_canvas_item`**：按 CanvasItem 变换、裁剪与可见状态筛选绘制项。
- `servers/rendering/renderer_canvas_cull.cpp:495-508` **`RendererCanvasCull::render_canvas`**：渲染选定 canvas 的项目列表，连接可见性/排序状态与 rasterizer。
- `servers/rendering/renderer_viewport.cpp:338-765` **`RendererViewport::_draw_viewport`**：从 Viewport 状态收集画布与场景绘制工作。

## 本课源码复刻

`src/upstream/` 按引擎原目录保存本课涉及的完整上游文件副本；`.excerpt` 保留所列原始行号函数摘录。副本逐字节对应 `engine/godot-4.7/`，SHA-256 清单可核验。优先从摘录读关键分支，再打开完整文件检查调用方和成员状态。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 阅读顺序 | 完整上游源码 | 函数摘录 | 快照行号 |
| --- | --- | --- | --- |
| 1 | [renderer_canvas_cull.cpp](src/upstream/servers/rendering/renderer_canvas_cull.cpp) | [摘录 71-109, 304-493, 495-508](src/upstream/servers/rendering/renderer_canvas_cull.cpp.excerpt) | `engine/godot-4.7/servers/rendering/renderer_canvas_cull.cpp:71-109, 304-493, 495-508` |
| 2 | [renderer_viewport.cpp](src/upstream/servers/rendering/renderer_viewport.cpp) | [摘录 338-765](src/upstream/servers/rendering/renderer_viewport.cpp.excerpt) | `engine/godot-4.7/servers/rendering/renderer_viewport.cpp:338-765` |

校验和源码文件清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

## GDScript 源码复刻

`src/source_replay.gd` 用本代脚本基类和字段复刻这条链中的关键状态变化：画布子树收集、可见性过滤、排序与画布提交。模型不调用引擎私有 C++，只供逐步对照上方函数。

| GDScript 函数 | 对照步骤 |
| --- | --- |
| `_collect_canvas_items()` | 从画布子树收集候选项。 |
| `_cull_items()` | 删除模型中的不可见项目。 |
| `_sort_items()` | 按预设层级形成绘制次序。 |
| `_draw_canvas()` | 提交可见且已排序的项目。 |

## 最小 Godot/GDScript 实验

**实验：Canvas、Viewport 变换与绘制次序。** 绘制重叠矩形并打印 Viewport canvas transform；改变绘制顺序后比较画布项的可见结果。



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

模型只处理小型 CanvasItem 树和稳定排序；不模拟光照、Y-sort 完整规则、canvas layer、混合模式或渲染批处理。

GDScript 教学模型只模拟状态传递，不是 C++ 的逐行翻译，也不执行引擎内部线程或 GPU 工作。

## 下一课

继续阅读 [s37_3d_render_instances](../s37_3d_render_instances/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
