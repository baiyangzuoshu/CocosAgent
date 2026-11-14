# 本课源码副本与复刻模型

源码依据：只读快照 engine/godot-4.7/。upstream/ 按上游原路径保存本课涉及的完整 C++、头文件和构建脚本副本；这些文件不作为可独立编译工程，也不修改 engine/ 快照。

先读课程 README 的调用链，再按摘录行号定位函数和分支，随后回到完整文件查看上下文。上游实现的最终依据始终是仓库 engine/ 快照。

| 阅读顺序 | 完整上游副本 | 函数/行号摘录 | 源码快照路径 |
| --- | --- | --- | --- |
| 1 | [object.cpp](upstream/core/object/object.cpp) | [1179-1221 ; 1233-1315 ; 1518-1580 ](upstream/core/object/object.cpp.excerpt) | engine/godot-4.7/core/object/object.cpp |
| 2 | [callable.cpp](upstream/core/variant/callable.cpp) | [44-87 ](upstream/core/variant/callable.cpp.excerpt) | engine/godot-4.7/core/variant/callable.cpp |
| 3 | [variant.h](upstream/core/variant/variant.h) | [922-940 ](upstream/core/variant/variant.h.excerpt) | engine/godot-4.7/core/variant/variant.h |

## GDScript 源码教学复刻

[source_replay.gd](source_replay.gd) 执行课程 README 列出的状态变化、参数传递和错误/分支路径。它是教学模型，不是 C++ 的逐行转译；公开 API 行为由课程根目录的独立实验观察。

## 证据边界

源码副本用于核对上游函数；摘录用于快速定位；教学模型用于理解选定算法；项目实验用于观察对应版本的公开行为。没有实际运行记录时，不把实验称为已验证。
