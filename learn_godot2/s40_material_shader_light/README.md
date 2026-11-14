# 第 40 课：材质、shader、灯光与绘制状态

**源码版本：** `godot-2.1`（2.1.7-rc）。本课按对应快照追踪 C++，再用独立 Godot/GDScript 工程对照可观察行为。

## 本课问题

FixedMaterial 与 Light 参数怎样映射到 Material/Light RID 和服务端状态？

## 本课增量

跟踪 FixedMaterial 和 Light 的参数写入及 RID 同步，注意这不是 GPU shader 编译模拟。

## C++ 源码追踪

```text
FixedMaterial parameter → Material RID; Light::set_color/set_parameter → VisualServerRaster light state
```

从左到右逐层记录参数在哪一层转换、状态在哪一层更新、何处调用下一层。链尾结论只依据本课列出的版本源码，不跨版本外推。

- `scene/resources/material.cpp:67-73` **`Material::set_blend_mode`**：材质状态改变入口；追踪参数是否触发 shader/材质更新。
- `scene/resources/material.cpp:54-57` **`Material::get_rid`**：返回材质资源对应的服务器 RID，区分 Resource 与服务端状态。
- `scene/resources/material.cpp:216-241` **`FixedMaterial::set_parameter`**：FixedMaterial 参数写入后更新材质 RID 对应的渲染状态。
- `scene/3d/light.cpp:49-58` **`Light::set_parameter`**：Light::set_parameter 把能量等 Light 参数传到对应 VisualServer light RID。
- `scene/3d/light.cpp:66-72` **`Light::set_color`**：Light::set_color 把颜色状态传到 VisualServer light RID。
- `servers/visual/visual_server_raster.cpp:796-800` **`VisualServerRaster::light_set_param`**：Raster 实现保存灯光数值参数供场景绘制使用。
- `servers/visual/visual_server_raster.cpp:757-760` **`VisualServerRaster::light_set_color`**：Raster 实现保存灯光颜色状态供场景绘制使用。

## 本课源码复刻

`src/upstream/` 按引擎原目录保存本课涉及的完整上游文件副本；`.excerpt` 保留所列原始行号函数摘录。副本逐字节对应 `engine/godot-2.1/`，SHA-256 清单可核验。优先从摘录读关键分支，再打开完整文件检查调用方和成员状态。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 阅读顺序 | 完整上游源码 | 函数摘录 | 快照行号 |
| --- | --- | --- | --- |
| 1 | [material.cpp](src/upstream/scene/resources/material.cpp) | [摘录 54-57, 67-73, 216-241](src/upstream/scene/resources/material.cpp.excerpt) | `engine/godot-2.1/scene/resources/material.cpp:54-57, 67-73, 216-241` |
| 2 | [light.cpp](src/upstream/scene/3d/light.cpp) | [摘录 49-58, 66-72](src/upstream/scene/3d/light.cpp.excerpt) | `engine/godot-2.1/scene/3d/light.cpp:49-58, 66-72` |
| 3 | [visual_server_raster.cpp](src/upstream/servers/visual/visual_server_raster.cpp) | [摘录 757-760, 796-800](src/upstream/servers/visual/visual_server_raster.cpp.excerpt) | `engine/godot-2.1/servers/visual/visual_server_raster.cpp:757-760, 796-800` |

校验和源码文件清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

## GDScript 源码复刻

`src/source_replay.gd` 用本代脚本基类和字段复刻这条链中的关键状态变化：材质参数写入、dirty 标记和 shader/RID 同步。模型不调用引擎私有 C++，只供逐步对照上方函数。

| GDScript 函数 | 对照步骤 |
| --- | --- |
| `_set_parameter()` | 更新材质参数字典。 |
| `_mark_dirty()` | 将 shader/material 状态标记为需同步。 |
| `_sync_material_rid()` | 清除 dirty 并推进模型代数。 |
| `_update_light()` | 模拟 Light 参数经服务端 light RID 同步。 |

## 最小 Godot/GDScript 实验

**实验：Material、Shader 与 Light 参数。** 给网格设置本代材质颜色并加入 DirectionalLight；Godot 1/2 使用 FixedMaterial/Light 参数 API，Godot 3/4 使用 SpatialMaterial/StandardMaterial3D 和 light_color，对照服务器更新路径。

Godot 1.1/2.1 没有内置 CubeMesh；探针使用 Mesh 与 Vector3Array 创建一个三角面，避免套用后续版本的 primitive mesh API。

- 项目入口：[`main.tscn`](main.tscn)
- 探针脚本：[`probe.gd`](probe.gd)
- 模型脚本：[`src/source_replay.gd`](src/source_replay.gd)


## 运行与观察

在本课目录使用与工程格式匹配的 Godot 程序启动：

```sh
godot -path .
```

**预期观察：** 模型输出材质/灯光参数更新；运行时场景显示设置了材质并由方向光照亮的网格。逐个修改 albedo 或 light_color 后重运行，对照参数写入路径。

**动手改一处：** 按实验主题修改一个输入、尺寸、变换、材质或可见性参数；先预测状态/输出，再沿上方 C++ 链找出负责更新的函数。

## 简化与边界

模型仅保留 FixedMaterial 与 Light 参数字典；不编译 shader、不计算光照，也不触发后端绘制。

GDScript 教学模型只模拟状态传递，不是 C++ 的逐行翻译，也不执行引擎内部线程或 GPU 工作。

## 下一课

下一课按大纲进入 Rasterizer 后端与帧输出。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
