# 第 39 课：相机可见性、裁剪和场景遍历

**源码版本：** `godot-2.1`（2.1.7-rc）。本课按对应快照追踪 C++，再用独立 Godot/GDScript 工程对照可观察行为。

## 本课问题

Camera 的投影参数如何传到 VisualServer，场景实例怎样按相机范围筛选？

## 本课增量

把 Camera projection/transform 更新与场景侧相机可见性筛选接起来。

## C++ 源码追踪

```text
Camera::make_current / projection → VisualServerRaster camera state → instances_cull_convex
```

从左到右逐层记录参数在哪一层转换、状态在哪一层更新、何处调用下一层。链尾结论只依据本课列出的版本源码，不跨版本外推。

- `scene/3d/camera.cpp:177-195` **`Camera::_update_camera`**：从节点参数和变换组装相机投影/变换并通知服务器。
- `scene/3d/camera.cpp:245-258` **`Camera::set_perspective`**：修改透视投影参数并更新相机状态。
- `scene/3d/camera.cpp:280-290` **`Camera::make_current`**：将此相机登记为当前活动相机。
- `servers/visual/visual_server_raster.cpp:1355-1363` **`VisualServerRaster::camera_set_perspective`**：服务端保存相机透视参数，供后续场景绘制取用。
- `servers/visual/visual_server_raster.cpp:2526-2546` **`VisualServerRaster::instances_cull_convex`**：按凸体/相机体积筛选空间中的候选实例。

## 本课源码复刻

`src/upstream/` 按引擎原目录保存本课涉及的完整上游文件副本；`.excerpt` 保留所列原始行号函数摘录。副本逐字节对应 `engine/godot-2.1/`，SHA-256 清单可核验。优先从摘录读关键分支，再打开完整文件检查调用方和成员状态。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 阅读顺序 | 完整上游源码 | 函数摘录 | 快照行号 |
| --- | --- | --- | --- |
| 1 | [camera.cpp](src/upstream/scene/3d/camera.cpp) | [摘录 177-195, 245-258, 280-290](src/upstream/scene/3d/camera.cpp.excerpt) | `engine/godot-2.1/scene/3d/camera.cpp:177-195, 245-258, 280-290` |
| 2 | [visual_server_raster.cpp](src/upstream/servers/visual/visual_server_raster.cpp) | [摘录 1355-1363, 2526-2546](src/upstream/servers/visual/visual_server_raster.cpp.excerpt) | `engine/godot-2.1/servers/visual/visual_server_raster.cpp:1355-1363, 2526-2546` |

校验和源码文件清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

## GDScript 源码复刻

`src/source_replay.gd` 用本代脚本基类和字段复刻这条链中的关键状态变化：相机投影参数、对象范围检查和可见列表生成。模型不调用引擎私有 C++，只供逐步对照上方函数。

| GDScript 函数 | 对照步骤 |
| --- | --- |
| `_make_projection()` | 保存相机 near/far 投影状态。 |
| `_collect_visible()` | 遍历场景对象候选。 |
| `_test_bounds()` | 按简化距离条件筛选可见对象。 |

## 最小 Godot/GDScript 实验

**实验：Camera 投影与可见性。** 创建当前 Camera 和网格，修改相机位置/投影参数，观察对象是否进入视野并对照裁剪入口。

Godot 1.1/2.1 没有内置 CubeMesh；探针使用 Mesh 与 Vector3Array 创建一个三角面，避免套用后续版本的 primitive mesh API。

- 项目入口：[`main.tscn`](main.tscn)
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

模型按距离和 near/far 简化相机裁剪，不等同于真实平面/AABB、遮挡或线程化裁剪。

GDScript 教学模型只模拟状态传递，不是 C++ 的逐行翻译，也不执行引擎内部线程或 GPU 工作。

## 下一课

继续阅读 [s40_material_shader_light](../s40_material_shader_light/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
