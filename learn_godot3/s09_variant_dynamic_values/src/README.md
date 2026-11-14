# 本课源码副本与复刻模型

源码依据：只读快照 engine/godot-3.6/。upstream/ 按上游原路径保存本课涉及的完整 C++、头文件和构建脚本副本；这些文件不作为可独立编译工程，也不修改 engine/ 快照。

先读课程 README 的调用链，再按摘录行号定位函数和分支，随后回到完整文件查看上下文。上游实现的最终依据始终是仓库 engine/ 快照。

| 阅读顺序 | 完整上游副本 | 函数/行号摘录 | 源码快照路径 |
| --- | --- | --- | --- |
| 1 | [object.cpp](upstream/core/object.cpp) | [819-900 ](upstream/core/object.cpp.excerpt) | engine/godot-3.6/core/object.cpp |
| 2 | [variant.cpp](upstream/core/variant.cpp) | [162-210 ](upstream/core/variant.cpp.excerpt) | engine/godot-3.6/core/variant.cpp |
| 3 | [variant.h](upstream/core/variant.h) | [58-110 ](upstream/core/variant.h.excerpt) | engine/godot-3.6/core/variant.h |
| 4 | [variant_call.cpp](upstream/core/variant_call.cpp) | [1217-1285 ](upstream/core/variant_call.cpp.excerpt) | engine/godot-3.6/core/variant_call.cpp |
| 5 | [gdscript_function.cpp](upstream/modules/gdscript/gdscript_function.cpp) | [432-455 ; 947-970 ](upstream/modules/gdscript/gdscript_function.cpp.excerpt) | engine/godot-3.6/modules/gdscript/gdscript_function.cpp |
| 6 | [gdscript_functions.cpp](upstream/modules/gdscript/gdscript_functions.cpp) | [616-638 ; 1768-1779 ; 1859-1869 ](upstream/modules/gdscript/gdscript_functions.cpp.excerpt) | engine/godot-3.6/modules/gdscript/gdscript_functions.cpp |

## GDScript 源码教学复刻

[source_replay.gd](source_replay.gd) 执行课程 README 列出的状态变化、参数传递和错误/分支路径。它是教学模型，不是 C++ 的逐行转译；公开 API 行为由课程根目录的独立实验观察。

## 证据边界

源码副本用于核对上游函数；摘录用于快速定位；教学模型用于理解选定算法；项目实验用于观察对应版本的公开行为。没有实际运行记录时，不把实验称为已验证。
