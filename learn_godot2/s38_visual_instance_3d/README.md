# 第 38 课：3D 实例注册与 VisualServer 场景接口

**源码版本：** `godot-2.1`（2.1.7-rc）。本课按对应快照追踪 C++，再用独立 Godot/GDScript 工程对照可观察行为。

## 本课问题

VisualInstance 何时创建服务器实例，base 与节点变换怎样同步？

## 本课增量

追踪 VisualInstance 节点生命周期、Mesh base、scenario 和 transform 的服务器同步。

## C++ 源码追踪

```text
VisualInstance::_notification → instance_create → instance_set_base / instance_set_transform
```

从左到右逐层记录参数在哪一层转换、状态在哪一层更新、何处调用下一层。链尾结论只依据本课列出的版本源码，不跨版本外推。

- `scene/3d/visual_instance.cpp:44-97` **`VisualInstance::_notification`**：节点进入/退出场景树时创建或销毁服务器 instance。
- `scene/3d/visual_instance.cpp:132-135` **`VisualInstance::set_base`**：把 Mesh/Geometry base 资源绑定到渲染 instance。
- `servers/visual/visual_server_raster.cpp:1942-1953` **`VisualServerRaster::instance_create`**：分配场景实例 RID，并初始化与节点生命周期关联的状态。
- `servers/visual/visual_server_raster.cpp:1955-2149` **`VisualServerRaster::instance_set_base`**：为已分配 instance 设置几何资源 base。
- `servers/visual/visual_server_raster.cpp:2312-2324` **`VisualServerRaster::instance_set_transform`**：把节点变换同步给服务器 instance。

## 本课源码复刻

`src/upstream/` 按引擎原目录保存本课涉及的完整上游文件副本；`.excerpt` 保留所列原始行号函数摘录。副本逐字节对应 `engine/godot-2.1/`，SHA-256 清单可核验。优先从摘录读关键分支，再打开完整文件检查调用方和成员状态。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 阅读顺序 | 完整上游源码 | 函数摘录 | 快照行号 |
| --- | --- | --- | --- |
| 1 | [visual_instance.cpp](src/upstream/scene/3d/visual_instance.cpp) | [摘录 44-97, 132-135](src/upstream/scene/3d/visual_instance.cpp.excerpt) | `engine/godot-2.1/scene/3d/visual_instance.cpp:44-97, 132-135` |
| 2 | [visual_server_raster.cpp](src/upstream/servers/visual/visual_server_raster.cpp) | [摘录 1942-1953, 1955-2149, 2312-2324](src/upstream/servers/visual/visual_server_raster.cpp.excerpt) | `engine/godot-2.1/servers/visual/visual_server_raster.cpp:1942-1953, 1955-2149, 2312-2324` |

校验和源码文件清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

## GDScript 源码复刻

`src/source_replay.gd` 用本代脚本基类和字段复刻这条链中的关键状态变化：instance 创建、mesh base、transform 与 scenario 绑定。模型不调用引擎私有 C++，只供逐步对照上方函数。

| GDScript 函数 | 对照步骤 |
| --- | --- |
| `_instance_enter_tree()` | 模拟进入树时创建 server instance RID。 |
| `_set_base()` | 绑定 mesh/geometry base。 |
| `_set_transform()` | 同步节点空间变换。 |
| `_set_scenario()` | 把实例归入当前 3D 场景。 |

## 最小 Godot/GDScript 实验

**实验：VisualInstance/MeshInstance 注册。** 创建 MeshInstance 与网格并加入 3D 场景树；检查节点生命周期如何触发服务器 instance 与 base 绑定。

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

模型只模拟一个几何 base 和一个 scenario；不包含 skeleton、插值、多材质和可见范围。

GDScript 教学模型只模拟状态传递，不是 C++ 的逐行翻译，也不执行引擎内部线程或 GPU 工作。

## 下一课

继续阅读 [s39_camera_visibility](../s39_camera_visibility/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
