# 第 38 课：Camera、视锥裁剪与可见对象列表

**源码版本：** `godot-4.7`（4.7.3-rc）。本课按对应快照追踪 C++，再用独立 Godot/GDScript 工程对照可观察行为。

## 本课问题

Camera 提供哪些投影状态？渲染服务器怎样用相机与场景实例筛选可见对象？

## 本课增量

把 Camera 的 projection/transform 更新和场景端可见性筛选接起来，区分相机参数与裁剪算法。

## C++ 源码追踪

```text
Camera3D projection/transform → RendererSceneCull::render_camera → _scene_cull
```

从左到右逐层记录参数在哪一层转换、状态在哪一层更新、何处调用下一层。链尾结论只依据本课列出的版本源码，不跨版本外推。

- `scene/3d/camera_3d.cpp:159-176` **`Camera3D::_update_camera`**：从节点参数和变换组装相机投影/变换并通知服务器。
- `scene/3d/camera_3d.cpp:365-373` **`Camera3D::make_current`**：将此相机登记为当前活动相机。
- `scene/3d/camera_3d.cpp:300-303` **`Camera3D::get_camera_projection`**：以 Projection 表示相机当前投影参数。
- `servers/rendering/renderer_scene_cull.cpp:2670-2785` **`RendererSceneCull::render_camera`**：进入指定相机的场景绘制路径并准备可见实例。
- `servers/rendering/renderer_scene_cull.cpp:2892-3291` **`RendererSceneCull::_scene_cull`**：收集相机范围内可绘制的实例并准备场景数据。

## 本课源码复刻

`src/upstream/` 按引擎原目录保存本课涉及的完整上游文件副本；`.excerpt` 保留所列原始行号函数摘录。副本逐字节对应 `engine/godot-4.7/`，SHA-256 清单可核验。优先从摘录读关键分支，再打开完整文件检查调用方和成员状态。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 阅读顺序 | 完整上游源码 | 函数摘录 | 快照行号 |
| --- | --- | --- | --- |
| 1 | [camera_3d.cpp](src/upstream/scene/3d/camera_3d.cpp) | [摘录 159-176, 300-303, 365-373](src/upstream/scene/3d/camera_3d.cpp.excerpt) | `engine/godot-4.7/scene/3d/camera_3d.cpp:159-176, 300-303, 365-373` |
| 2 | [renderer_scene_cull.cpp](src/upstream/servers/rendering/renderer_scene_cull.cpp) | [摘录 2670-2785, 2892-3291](src/upstream/servers/rendering/renderer_scene_cull.cpp.excerpt) | `engine/godot-4.7/servers/rendering/renderer_scene_cull.cpp:2670-2785, 2892-3291` |

校验和源码文件清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

## GDScript 源码复刻

`src/source_replay.gd` 用本代脚本基类和字段复刻这条链中的关键状态变化：相机投影参数、对象范围检查和可见列表生成。模型不调用引擎私有 C++，只供逐步对照上方函数。

| GDScript 函数 | 对照步骤 |
| --- | --- |
| `_make_projection()` | 保存相机 near/far 投影状态。 |
| `_collect_visible()` | 遍历场景对象候选。 |
| `_test_bounds()` | 按简化距离条件筛选可见对象。 |

## 最小 Godot/GDScript 实验

**实验：Camera 投影与可见性。** 脚本显式设置当前相机的位置、视场角和 near/far；先观察默认网格，再修改这些参数并重新运行，对照视野变化和 C++ 裁剪入口。



- 项目入口：[`main.tscn`](main.tscn)
- 探针脚本：[`probe.gd`](probe.gd)
- 模型脚本：[`src/source_replay.gd`](src/source_replay.gd)


## 运行与观察

在本课目录使用与工程格式匹配的 Godot 程序启动：

```sh
godot --path .
```

**预期观察：** 模型先输出相机/可见性状态；运行时先观察当前视野中的网格。将脚本中的相机位置或投影参数改动后重新运行，比较网格是否进入视野，再回到源码中的裁剪路径。

**动手改一处：** 按实验主题修改一个输入、尺寸、变换、材质或可见性参数；先预测状态/输出，再沿上方 C++ 链找出负责更新的函数。

## 简化与边界

模型使用 near/far、距离和 layer 的简化筛选；并不等同于实际平面/AABB、遮挡、LOD 或线程化裁剪算法。

GDScript 教学模型只模拟状态传递，不是 C++ 的逐行翻译，也不执行引擎内部线程或 GPU 工作。

## 下一课

继续阅读 [s39_material_shader](../s39_material_shader/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
