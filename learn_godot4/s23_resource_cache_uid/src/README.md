# 本课源码副本

`upstream/` 中的完整文件来自仓库本地 `engine/godot-4.7/` 快照，按原目录复制，不修改引擎源码。摘录保留本课函数的原始行号；先读课程 README 的调用链，再按下表进入完整文件检查前后条件与调用方。

| 顺序 | 完整源码副本 | 关键函数摘录 | 源码快照路径 |
| --- | --- | --- | --- |
| 1 | [resource.cpp](upstream/core/io/resource.cpp) | [852-871](upstream/core/io/resource.cpp.excerpt) | `engine/godot-4.7/core/io/resource.cpp` |
| 2 | [resource_uid.cpp](upstream/core/io/resource_uid.cpp) | [113-132, 162-174, 195-220, 243-250, 252-257](upstream/core/io/resource_uid.cpp.excerpt) | `engine/godot-4.7/core/io/resource_uid.cpp` |
| 3 | [resource_loader.cpp](upstream/core/io/resource_loader.cpp) | [1412-1426](upstream/core/io/resource_loader.cpp.excerpt) | `engine/godot-4.7/core/io/resource_loader.cpp` |

逐字节副本以 `engine/` 中该版本文件为准；摘录只截取函数体，不是可独立编译的引擎模块。
