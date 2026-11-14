# 本课源码副本与复刻模型

源码依据：只读快照 engine/godot-3.6/。upstream/ 按上游原路径保存本课涉及的完整 C++、头文件和构建脚本副本；这些文件不作为可独立编译工程，也不修改 engine/ 快照。

先读课程 README 的调用链，再按摘录行号定位函数和分支，随后回到完整文件查看上下文。上游实现的最终依据始终是仓库 engine/ 快照。

| 阅读顺序 | 完整上游副本 | 函数/行号摘录 | 源码快照路径 |
| --- | --- | --- | --- |
| 1 | [core_bind.cpp](upstream/core/bind/core_bind.cpp) | [2949-2968 ](upstream/core/bind/core_bind.cpp.excerpt) | engine/godot-3.6/core/bind/core_bind.cpp |
| 2 | [class_db.cpp](upstream/core/class_db.cpp) | [491-494 ](upstream/core/class_db.cpp.excerpt) | engine/godot-3.6/core/class_db.cpp |
| 3 | [class_db.h](upstream/core/class_db.h) | [165-181 ](upstream/core/class_db.h.excerpt) | engine/godot-3.6/core/class_db.h |
| 4 | [object.cpp](upstream/core/object.cpp) | [1673-1675 ](upstream/core/object.cpp.excerpt) | engine/godot-3.6/core/object.cpp |
| 5 | [gdscript.cpp](upstream/modules/gdscript/gdscript.cpp) | [60-78 ](upstream/modules/gdscript/gdscript.cpp.excerpt) | engine/godot-3.6/modules/gdscript/gdscript.cpp |
| 6 | [node_2d.cpp](upstream/scene/2d/node_2d.cpp) | [382-430 ](upstream/scene/2d/node_2d.cpp.excerpt) | engine/godot-3.6/scene/2d/node_2d.cpp |
| 7 | [node_2d.h](upstream/scene/2d/node_2d.h) | [37-37 ](upstream/scene/2d/node_2d.h.excerpt) | engine/godot-3.6/scene/2d/node_2d.h |
| 8 | [register_scene_types.cpp](upstream/scene/register_scene_types.cpp) | [250-287 ](upstream/scene/register_scene_types.cpp.excerpt) | engine/godot-3.6/scene/register_scene_types.cpp |

## GDScript 源码教学复刻

[source_replay.gd](source_replay.gd) 执行课程 README 列出的状态变化、参数传递和错误/分支路径。它是教学模型，不是 C++ 的逐行转译；公开 API 行为由课程根目录的独立实验观察。

## 证据边界

源码副本用于核对上游函数；摘录用于快速定位；教学模型用于理解选定算法；项目实验用于观察对应版本的公开行为。没有实际运行记录时，不把实验称为已验证。
