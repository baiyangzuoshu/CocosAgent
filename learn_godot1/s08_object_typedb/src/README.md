# 本课源码副本

本课使用 `godot-1.1`（Godot 1.1）快照。`upstream/` 中的 C++/头文件/构建脚本是从仓库 `engine/godot-1.1/` 按原路径复制的完整上游文件，逐字节保留；本目录不修改引擎快照，也不把这些文件当作独立可编译工程。

先读课程 README 中的调用链，再按下表中的行段打开摘录；随后在完整文件副本里查看函数上下文、条件分支和前后调用。完整源码以仓库只读 `engine/` 快照为最终依据。

| 阅读顺序 | 完整上游文件副本 | 关键行段摘录 | 上游文件 |
| --- | --- | --- | --- |
| 1 | [object.cpp](upstream/core/object.cpp) | [1435-1438](upstream/core/object.cpp.excerpt) | `engine/godot-1.1/core/object.cpp` |
| 2 | [object_type_db.cpp](upstream/core/object_type_db.cpp) | [272-296, 300-317](upstream/core/object_type_db.cpp.excerpt) | `engine/godot-1.1/core/object_type_db.cpp` |
| 3 | [object_type_db.h](upstream/core/object_type_db.h) | [195-204](upstream/core/object_type_db.h.excerpt) | `engine/godot-1.1/core/object_type_db.h` |
| 4 | [gd_script.cpp](upstream/modules/gdscript/gd_script.cpp) | [1422-1448](upstream/modules/gdscript/gd_script.cpp.excerpt) | `engine/godot-1.1/modules/gdscript/gd_script.cpp` |
| 5 | [node_2d.h](upstream/scene/2d/node_2d.h) | [34-36](upstream/scene/2d/node_2d.h.excerpt) | `engine/godot-1.1/scene/2d/node_2d.h` |
| 6 | [register_scene_types.cpp](upstream/scene/register_scene_types.cpp) | [231-266](upstream/scene/register_scene_types.cpp.excerpt) | `engine/godot-1.1/scene/register_scene_types.cpp` |

## 副本核对

每个完整文件均与对应快照文件逐字节复制。摘录文件开头注明上游相对路径和行号；查阅时可用行号在完整副本中定位。
## GDScript 源码复刻

[`source_replay.gd`](source_replay.gd) 把本课 C++ 路径中的关键状态和调用顺序写成可运行的 GDScript 小模型。它保留概念对应关系，便于观察分支/状态变化；它不是 Godot C++ 实现，也不替代 `upstream/` 的逐字节原文。主项目脚本先执行该模型，再调用真实 Godot API 做对照。
