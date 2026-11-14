# 本课源码副本

本课使用 `godot-4.7`（Godot 4.7）快照。`upstream/` 中的 C++/头文件/构建脚本是从仓库 `engine/godot-4.7/` 按原路径复制的完整上游文件，逐字节保留；本目录不修改引擎快照，也不把这些文件当作独立可编译工程。

先读课程 README 中的调用链，再按下表中的行段打开摘录；随后在完整文件副本里查看函数上下文、条件分支和前后调用。完整源码以仓库只读 `engine/` 快照为最终依据。

| 阅读顺序 | 完整上游文件副本 | 关键行段摘录 | 上游文件 |
| --- | --- | --- | --- |
| 1 | [engine.cpp](upstream/core/config/engine.cpp) | [153-174](upstream/core/config/engine.cpp.excerpt) | `engine/godot-4.7/core/config/engine.cpp` |
| 2 | [core_bind.cpp](upstream/core/core_bind.cpp) | [1959-1960](upstream/core/core_bind.cpp.excerpt) | `engine/godot-4.7/core/core_bind.cpp` |
| 3 | [core_builders.py](upstream/core/core_builders.py) | [17-34](upstream/core/core_builders.py.excerpt) | `engine/godot-4.7/core/core_builders.py` |
| 4 | [register_core_types.cpp](upstream/core/register_core_types.cpp) | [364-369](upstream/core/register_core_types.cpp.excerpt) | `engine/godot-4.7/core/register_core_types.cpp` |
| 5 | [version.h](upstream/core/version.h) | [33-33](upstream/core/version.h.excerpt) | `engine/godot-4.7/core/version.h` |
| 6 | [main.cpp](upstream/main/main.cpp) | [1035-1035](upstream/main/main.cpp.excerpt) | `engine/godot-4.7/main/main.cpp` |
| 7 | [methods.py](upstream/methods.py) | [136-165](upstream/methods.py.excerpt) | `engine/godot-4.7/methods.py` |
| 8 | [scene_tree.cpp](upstream/scene/main/scene_tree.cpp) | [688-688](upstream/scene/main/scene_tree.cpp.excerpt) | `engine/godot-4.7/scene/main/scene_tree.cpp` |
| 9 | [version.py](upstream/version.py) | [1-9](upstream/version.py.excerpt) | `engine/godot-4.7/version.py` |

## 副本核对

每个完整文件均与对应快照文件逐字节复制。摘录文件开头注明上游相对路径和行号；查阅时可用行号在完整副本中定位。
## GDScript 源码复刻

[`source_replay.gd`](source_replay.gd) 把本课 C++ 路径中的关键状态和调用顺序写成可运行的 GDScript 小模型。它保留概念对应关系，便于观察分支/状态变化；它不是 Godot C++ 实现，也不替代 `upstream/` 的逐字节原文。主项目脚本先执行该模型，再调用真实 Godot API 做对照。
