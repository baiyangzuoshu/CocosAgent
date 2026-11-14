# 第 36 课：2D Canvas、排序、变换与可见性

**源码版本：** `godot-3.6`（3.6.4-rc）。本课按对应快照追踪 C++，再用独立 Godot/GDScript 工程对照可观察行为。

## 本课问题

CanvasItem 树怎样累计变换、裁剪和可见性，再按层级/深度组织绘制？

## 本课增量

从节点 CanvasItem 子树追到服务端绘制遍历、裁剪、排序与 viewport 提交。

## C++ 源码追踪

```text
VisualServerCanvas::_render_canvas_item_tree → render_canvas → VisualServerRaster::draw
```

从左到右逐层记录参数在哪一层转换、状态在哪一层更新、何处调用下一层。链尾结论只依据本课列出的版本源码，不跨版本外推。

- `servers/visual/visual_server_canvas.cpp:40-61` **`VisualServerCanvas::_render_canvas_item_tree`**：遍历 CanvasItem 子树并组织变换、裁剪和待绘制项目。
- `servers/visual/visual_server_canvas.cpp:369-509` **`VisualServerCanvas::_render_canvas_item_cull_by_item`**：按当前项目状态筛选画布子项与可见内容。
- `servers/visual/visual_server_canvas.cpp:715-821` **`VisualServerCanvas::render_canvas`**：渲染选定 canvas 的项目列表，连接可见性/排序状态与 rasterizer。
- `servers/visual/visual_server_raster.cpp:104-135` **`VisualServerRaster::draw`**：服务端帧入口；区分场景服务器的 draw 请求与底层帧钩子。

## 本课源码复刻

`src/upstream/` 按引擎原目录保存本课涉及的完整上游文件副本；`.excerpt` 保留所列原始行号函数摘录。副本逐字节对应 `engine/godot-3.6/`，SHA-256 清单可核验。优先从摘录读关键分支，再打开完整文件检查调用方和成员状态。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 阅读顺序 | 完整上游源码 | 函数摘录 | 快照行号 |
| --- | --- | --- | --- |
| 1 | [visual_server_canvas.cpp](src/upstream/servers/visual/visual_server_canvas.cpp) | [摘录 40-61, 369-509, 715-821](src/upstream/servers/visual/visual_server_canvas.cpp.excerpt) | `engine/godot-3.6/servers/visual/visual_server_canvas.cpp:40-61, 369-509, 715-821` |
| 2 | [visual_server_raster.cpp](src/upstream/servers/visual/visual_server_raster.cpp) | [摘录 104-135](src/upstream/servers/visual/visual_server_raster.cpp.excerpt) | `engine/godot-3.6/servers/visual/visual_server_raster.cpp:104-135` |

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

继续阅读 [s37_visual_instance_3d](../s37_visual_instance_3d/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
