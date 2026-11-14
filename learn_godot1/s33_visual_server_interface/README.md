# 第 33 课：VisualServer 如何隔离场景节点和渲染后端

**源码版本：** `godot-1.1`（1.1 stable）。本课按对应快照追踪 C++，再用独立 Godot/GDScript 工程对照可观察行为。

## 本课问题

场景节点通过哪个 VisualServer 接口提交工作？本地快照中的 VisualServerRaster 如何承接这条接口？

## 本课增量

沿公共 VisualServer 接口到 VisualServerRaster 实现追踪一次 draw 请求，明确场景节点依赖的抽象层。

## C++ 源码追踪

```text
VisualServer::get_singleton → VisualServerRaster implementation → draw request
```

从左到右逐层记录参数在哪一层转换、状态在哪一层更新、何处调用下一层。链尾结论只依据本课列出的版本源码，不跨版本外推。

- `servers/visual_server.cpp:36-39` **`VisualServer::get_singleton`**：访问公开服务器接口；场景侧通过抽象接口而非直接依赖后端类。
- `servers/visual/visual_server_raster.cpp:7365-7377` **`VisualServerRaster::draw`**：服务端帧入口；区分场景服务器的 draw 请求与底层帧钩子。

## 本课源码复刻

`src/upstream/` 按引擎原目录保存本课涉及的完整上游文件副本；`.excerpt` 保留所列原始行号函数摘录。副本逐字节对应 `engine/godot-1.1/`，SHA-256 清单可核验。优先从摘录读关键分支，再打开完整文件检查调用方和成员状态。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 阅读顺序 | 完整上游源码 | 函数摘录 | 快照行号 |
| --- | --- | --- | --- |
| 1 | [visual_server.cpp](src/upstream/servers/visual_server.cpp) | [摘录 36-39](src/upstream/servers/visual_server.cpp.excerpt) | `engine/godot-1.1/servers/visual_server.cpp:36-39` |
| 2 | [visual_server_raster.cpp](src/upstream/servers/visual/visual_server_raster.cpp) | [摘录 7365-7377](src/upstream/servers/visual/visual_server_raster.cpp.excerpt) | `engine/godot-1.1/servers/visual/visual_server_raster.cpp:7365-7377` |

校验和源码文件清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

## GDScript 源码复刻

`src/source_replay.gd` 用本代脚本基类和字段复刻这条链中的关键状态变化：公开 VisualServer 接口到 VisualServerRaster 实现的请求转发。模型不调用引擎私有 C++，只供逐步对照上方函数。

| GDScript 函数 | 对照步骤 |
| --- | --- |
| `_get_server()` | 通过公开 singleton 名称访问服务器抽象层。 |
| `_draw_request()` | 沿公共接口记录一次 draw 请求。 |
| `_backend_draw()` | 由本代 Raster 实现接收请求。 |

## 最小 Godot/GDScript 实验

**实验：VisualServer 接口边界。** 创建并释放一个 CanvasItem RID，同时对照源码中公共 VisualServer 接口和当前 Raster 实现。



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

只保留服务器接口和一条 draw 请求，不复刻所有 VisualServer API、线程化 rasterizer 或 GPU 后端。

GDScript 教学模型只模拟状态传递，不是 C++ 的逐行翻译，也不执行引擎内部线程或 GPU 工作。

## 下一课

继续阅读 [s34_rid_resources](../s34_rid_resources/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
