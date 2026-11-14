# 本课源码副本与复刻模型

源码依据：只读快照 engine/godot-4.7/。upstream/ 按上游原路径保存本课涉及的完整 C++、头文件和构建脚本副本；这些文件不作为可独立编译工程，也不修改 engine/ 快照。

先读课程 README 的调用链，再按摘录行号定位函数和分支，随后回到完整文件查看上下文。上游实现的最终依据始终是仓库 engine/ 快照。

| 阅读顺序 | 完整上游副本 | 函数/行号摘录 | 源码快照路径 |
| --- | --- | --- | --- |
| 1 | [engine.cpp](upstream/core/config/engine.cpp) | [153-174 ](upstream/core/config/engine.cpp.excerpt) | engine/godot-4.7/core/config/engine.cpp |
| 2 | [core_bind.cpp](upstream/core/core_bind.cpp) | [1959-1960 ](upstream/core/core_bind.cpp.excerpt) | engine/godot-4.7/core/core_bind.cpp |
| 3 | [core_builders.py](upstream/core/core_builders.py) | [17-34](upstream/core/core_builders.py.excerpt) | engine/godot-4.7/core/core_builders.py |
| 4 | [register_core_types.cpp](upstream/core/register_core_types.cpp) | [364-369 ](upstream/core/register_core_types.cpp.excerpt) | engine/godot-4.7/core/register_core_types.cpp |
| 5 | [version.h](upstream/core/version.h) | [33-33 ](upstream/core/version.h.excerpt) | engine/godot-4.7/core/version.h |
| 6 | [main.cpp](upstream/main/main.cpp) | [1035-1035 ](upstream/main/main.cpp.excerpt) | engine/godot-4.7/main/main.cpp |
| 7 | [methods.py](upstream/methods.py) | [136-165](upstream/methods.py.excerpt) | engine/godot-4.7/methods.py |
| 8 | [scene_tree.cpp](upstream/scene/main/scene_tree.cpp) | [688-688 ](upstream/scene/main/scene_tree.cpp.excerpt) | engine/godot-4.7/scene/main/scene_tree.cpp |
| 9 | [version.py](upstream/version.py) | [1-9](upstream/version.py.excerpt) | engine/godot-4.7/version.py |

## GDScript 源码教学复刻

[source_replay.gd](source_replay.gd) 执行课程 README 列出的状态变化、参数传递和错误/分支路径。它是教学模型，不是 C++ 的逐行转译；公开 API 行为由课程根目录的独立实验观察。

## 证据边界

源码副本用于核对上游函数；摘录用于快速定位；教学模型用于理解选定算法；项目实验用于观察对应版本的公开行为。没有实际运行记录时，不把实验称为已验证。
