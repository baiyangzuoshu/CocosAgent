# 第 40 课：GLES 后端选择和渲染提交路径

**源码版本：** `godot-3.6`（3.6.4-rc）。本课按对应快照追踪 C++，再用独立 Godot/GDScript 工程对照可观察行为。

## 本课问题

一帧从服务器 draw 请求经过 viewport/rasterizer 或 RenderingDevice，最终在哪些阶段提交和呈现？

## 本课增量

对照本代帧提交边界：旧版 Rasterizer/GLES frame hooks 与 Godot 4 command queue / RenderingDevice。

## C++ 源码追踪

```text
VisualServerRaster::draw → viewport draw → RasterizerGLES2/GLES3 begin_frame/end_frame
```

从左到右逐层记录参数在哪一层转换、状态在哪一层更新、何处调用下一层。链尾结论只依据本课列出的版本源码，不跨版本外推。

- `servers/visual/visual_server_raster.cpp:104-135` **`VisualServerRaster::draw`**：服务端帧入口；区分场景服务器的 draw 请求与底层帧钩子。
- `drivers/gles2/rasterizer_gles2.cpp:270-294` **`RasterizerGLES2::begin_frame`**：开启 GLES 帧上下文并准备本帧渲染目标。
- `drivers/gles2/rasterizer_gles2.cpp:452-468` **`RasterizerGLES2::end_frame`**：结束后端帧工作并到达交换/呈现边界。
- `drivers/gles3/rasterizer_gles3.cpp:194-221` **`RasterizerGLES3::begin_frame`**：开启 GLES 帧上下文并准备本帧渲染目标。
- `drivers/gles3/rasterizer_gles3.cpp:408-426` **`RasterizerGLES3::end_frame`**：结束后端帧工作并到达交换/呈现边界。

## 本课源码复刻

`src/upstream/` 按引擎原目录保存本课涉及的完整上游文件副本；`.excerpt` 保留所列原始行号函数摘录。副本逐字节对应 `engine/godot-3.6/`，SHA-256 清单可核验。优先从摘录读关键分支，再打开完整文件检查调用方和成员状态。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 阅读顺序 | 完整上游源码 | 函数摘录 | 快照行号 |
| --- | --- | --- | --- |
| 1 | [visual_server_raster.cpp](src/upstream/servers/visual/visual_server_raster.cpp) | [摘录 104-135](src/upstream/servers/visual/visual_server_raster.cpp.excerpt) | `engine/godot-3.6/servers/visual/visual_server_raster.cpp:104-135` |
| 2 | [rasterizer_gles2.cpp](src/upstream/drivers/gles2/rasterizer_gles2.cpp) | [摘录 270-294, 452-468](src/upstream/drivers/gles2/rasterizer_gles2.cpp.excerpt) | `engine/godot-3.6/drivers/gles2/rasterizer_gles2.cpp:270-294, 452-468` |
| 3 | [rasterizer_gles3.cpp](src/upstream/drivers/gles3/rasterizer_gles3.cpp) | [摘录 194-221, 408-426](src/upstream/drivers/gles3/rasterizer_gles3.cpp.excerpt) | `engine/godot-3.6/drivers/gles3/rasterizer_gles3.cpp:194-221, 408-426` |

校验和源码文件清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

## GDScript 源码复刻

`src/source_replay.gd` 用本代脚本基类和字段复刻这条链中的关键状态变化：frame 开始、Viewport 绘制、后端 flush 与提交边界。模型不调用引擎私有 C++，只供逐步对照上方函数。

| GDScript 函数 | 对照步骤 |
| --- | --- |
| `_begin_frame()` | 进入新帧并记录起始阶段。 |
| `_draw_viewports()` | 记录主 Viewport 绘制阶段。 |
| `_flush()` | 记录后端命令刷新阶段。 |
| `_submit()` | 记录提交/present 边界。 |

## 最小 Godot/GDScript 实验

**实验：一帧的绘制提交边界。** 触发一次 Node2D 重绘并记录绘制回调，再对照帧路径区分 Canvas 命令、后端 flush 和呈现。



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

模型记录帧阶段，不调用后端 draw list、不提交 GPU 工作或测量 present/vsync；只用于对照静态 C++ 调用路径。

GDScript 教学模型只模拟状态传递，不是 C++ 的逐行翻译，也不执行引擎内部线程或 GPU 工作。

## 下一课

下一课按大纲进入 Viewport 渲染目标。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
