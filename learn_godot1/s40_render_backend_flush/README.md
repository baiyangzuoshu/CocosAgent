# 第 40 课：光栅化后端、命令刷新与一帧绘制

**源码版本：** `godot-1.1`（1.1 stable）。本课按对应快照追踪 C++，再用独立 Godot/GDScript 工程对照可观察行为。

## 本课问题

一帧从服务器 draw 请求经过 viewport/rasterizer 或 RenderingDevice，最终在哪些阶段提交和呈现？

## 本课增量

对照本代帧提交边界：旧版 Rasterizer/GLES frame hooks 与 Godot 4 command queue / RenderingDevice。

## C++ 源码追踪

```text
VisualServerRaster::draw → _draw_viewports → Rasterizer::flush_frame → GLES2 begin/end_frame
```

从左到右逐层记录参数在哪一层转换、状态在哪一层更新、何处调用下一层。链尾结论只依据本课列出的版本源码，不跨版本外推。

- `servers/visual/visual_server_raster.cpp:7197-7302` **`VisualServerRaster::_draw_viewports`**：提交 viewport 绘制工作到当前渲染后端。
- `servers/visual/visual_server_raster.cpp:7365-7377` **`VisualServerRaster::draw`**：服务端帧入口；区分场景服务器的 draw 请求与底层帧钩子。
- `servers/visual/rasterizer.cpp:598-601` **`Rasterizer::flush_frame`**：刷新 rasterizer 当前帧的命令/批次；与 OS present 区分。
- `drivers/gles2/rasterizer_gles2.cpp:4124-4233` **`RasterizerGLES2::begin_frame`**：开启 GLES 帧上下文并准备本帧渲染目标。
- `drivers/gles2/rasterizer_gles2.cpp:7844-7851` **`RasterizerGLES2::end_frame`**：结束后端帧工作并到达交换/呈现边界。

## 本课源码复刻

`src/upstream/` 按引擎原目录保存本课涉及的完整上游文件副本；`.excerpt` 保留所列原始行号函数摘录。副本逐字节对应 `engine/godot-1.1/`，SHA-256 清单可核验。优先从摘录读关键分支，再打开完整文件检查调用方和成员状态。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 阅读顺序 | 完整上游源码 | 函数摘录 | 快照行号 |
| --- | --- | --- | --- |
| 1 | [visual_server_raster.cpp](src/upstream/servers/visual/visual_server_raster.cpp) | [摘录 7197-7302, 7365-7377](src/upstream/servers/visual/visual_server_raster.cpp.excerpt) | `engine/godot-1.1/servers/visual/visual_server_raster.cpp:7197-7302, 7365-7377` |
| 2 | [rasterizer.cpp](src/upstream/servers/visual/rasterizer.cpp) | [摘录 598-601](src/upstream/servers/visual/rasterizer.cpp.excerpt) | `engine/godot-1.1/servers/visual/rasterizer.cpp:598-601` |
| 3 | [rasterizer_gles2.cpp](src/upstream/drivers/gles2/rasterizer_gles2.cpp) | [摘录 4124-4233, 7844-7851](src/upstream/drivers/gles2/rasterizer_gles2.cpp.excerpt) | `engine/godot-1.1/drivers/gles2/rasterizer_gles2.cpp:4124-4233, 7844-7851` |

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



- 项目入口：[`main.xml`](main.xml)
- 探针脚本：[`probe.gd`](probe.gd)
- 模型脚本：[`src/source_replay.gd`](src/source_replay.gd)
- 绘制探针：[`draw_probe.gd`](draw_probe.gd)

## 运行与观察

在本课目录使用与工程格式匹配的 Godot 程序启动：

```sh
godot -path .
```

**预期观察：** 启动后先打印 GDScript 模型中的状态转移，再执行本课公开 API 实验。模型打印用于检查调用顺序；只有引擎实际运行并留下日志后，才能把预期观察记为运行验证。

**动手改一处：** 按实验主题修改一个输入、尺寸、变换、材质或可见性参数；先预测状态/输出，再沿上方 C++ 链找出负责更新的函数。

## 简化与边界

模型记录帧阶段，不调用后端 draw list、不提交 GPU 工作或测量 present/vsync；只用于对照静态 C++ 调用路径。

GDScript 教学模型只模拟状态传递，不是 C++ 的逐行翻译，也不执行引擎内部线程或 GPU 工作。

## 下一课

S40 收束渲染后端主线；下一阶段按大纲进入 2D 物理服务器。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
