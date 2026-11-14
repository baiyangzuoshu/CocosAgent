# 第 34 课：RID 资源创建、更新与释放

**源码版本：** `godot-1.1`（1.1 stable）。本课按对应快照追踪 C++，再用独立 Godot/GDScript 工程对照可观察行为。

## 本课问题

场景节点如何拿到渲染服务器资源句柄？RID 的创建、更新与释放由哪一层负责？

## 本课增量

以 RID 为节点与服务器之间的轻量句柄，追踪具体实现如何分配所有者、路由调用和释放资源。

## C++ 源码追踪

```text
VisualServerRaster::canvas_item_create → RID owner → free(RID)
```

从左到右逐层记录参数在哪一层转换、状态在哪一层更新、何处调用下一层。链尾结论只依据本课列出的版本源码，不跨版本外推。

- `servers/visual/visual_server_raster.cpp:3270-3276` **`VisualServerRaster::canvas_item_create`**：分配画布项资源句柄；句柄本身不等于绘制命令或 GPU 对象。
- `servers/visual/visual_server_raster.cpp:4392-4671` **`VisualServerRaster::free`**：校验并释放由服务端 owner 管理的 RID 资源。

## 本课源码复刻

`src/upstream/` 按引擎原目录保存本课涉及的完整上游文件副本；`.excerpt` 保留所列原始行号函数摘录。副本逐字节对应 `engine/godot-1.1/`，SHA-256 清单可核验。优先从摘录读关键分支，再打开完整文件检查调用方和成员状态。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 阅读顺序 | 完整上游源码 | 函数摘录 | 快照行号 |
| --- | --- | --- | --- |
| 1 | [visual_server_raster.cpp](src/upstream/servers/visual/visual_server_raster.cpp) | [摘录 3270-3276, 4392-4671](src/upstream/servers/visual/visual_server_raster.cpp.excerpt) | `engine/godot-1.1/servers/visual/visual_server_raster.cpp:3270-3276, 4392-4671` |

校验和源码文件清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

## GDScript 源码复刻

`src/source_replay.gd` 用本代脚本基类和字段复刻这条链中的关键状态变化：RID 分配表、服务端状态更新与显式 free。模型不调用引擎私有 C++，只供逐步对照上方函数。

| GDScript 函数 | 对照步骤 |
| --- | --- |
| `_alloc_rid()` | 分配教学用整数句柄并登记资源类型。 |
| `_set_server_state()` | 更新句柄关联的模拟服务端状态。 |
| `_free_rid()` | 释放句柄并从活动资源表移除。 |

## 最小 Godot/GDScript 实验

**实验：VisualServer RID 创建与释放。** 创建一个低层 CanvasItem RID，输出句柄后立即释放；句柄只用于资源身份，不当作指针。



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

模型用整数模拟 RID，不复刻引擎 RID_Owner、generation、线程同步或错误处理；句柄数值不代表可复用对象地址。

GDScript 教学模型只模拟状态传递，不是 C++ 的逐行翻译，也不执行引擎内部线程或 GPU 工作。

## 下一课

继续阅读 [s35_canvas_item_commands](../s35_canvas_item_commands/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
