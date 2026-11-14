# 本课源码副本

`upstream/` 中的完整文件来自仓库本地 `engine/godot-2.1/` 快照，按原目录复制，不修改引擎源码。摘录保留本课函数的原始行号；先读课程 README 的调用链，再按下表进入完整文件检查前后条件与调用方。

| 顺序 | 完整源码副本 | 关键函数摘录 | 源码快照路径 |
| --- | --- | --- | --- |
| 1 | [scene_main_loop.cpp](upstream/scene/main/scene_main_loop.cpp) | [336-459](upstream/scene/main/scene_main_loop.cpp.excerpt) | `engine/godot-2.1/scene/main/scene_main_loop.cpp` |
| 2 | [node.cpp](upstream/scene/main/node.cpp) | [468-481, 487-499](upstream/scene/main/node.cpp.excerpt) | `engine/godot-2.1/scene/main/node.cpp` |
| 3 | [viewport.cpp](upstream/scene/main/viewport.cpp) | [2271-2278, 2280-2297](upstream/scene/main/viewport.cpp.excerpt) | `engine/godot-2.1/scene/main/viewport.cpp` |

逐字节副本以 `engine/` 中该版本文件为准；摘录只截取函数体，不是可独立编译的引擎模块。
