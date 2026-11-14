# 本课源码副本与 GDScript 复刻模型

课程版本：godot-4.7。engine/ 快照保持只读；upstream/ 保存本课引用文件的完整字节副本，摘录按原始行号从这些副本生成。

阅读顺序：先按课程 README 的 C++ 调用链进入函数，再打开完整文件查看上下文；摘录只负责快速定位，不替代源文件。

## 完整副本校验

在本目录执行 shasum -a 256 -c SOURCE_SHA256.txt。清单覆盖所有完整上游副本，不覆盖派生摘录。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [engine.cpp](upstream/core/config/engine.cpp) | [153-174](upstream/core/config/engine.cpp.excerpt) | engine/godot-4.7/core/config/engine.cpp |
| 2 | [core_bind.cpp](upstream/core/core_bind.cpp) | [1959-1960](upstream/core/core_bind.cpp.excerpt) | engine/godot-4.7/core/core_bind.cpp |
| 3 | [core_builders.py](upstream/core/core_builders.py) | [17-34](upstream/core/core_builders.py.excerpt) | engine/godot-4.7/core/core_builders.py |
| 4 | [register_core_types.cpp](upstream/core/register_core_types.cpp) | [364-369](upstream/core/register_core_types.cpp.excerpt) | engine/godot-4.7/core/register_core_types.cpp |
| 5 | [version.h](upstream/core/version.h) | [33-33](upstream/core/version.h.excerpt) | engine/godot-4.7/core/version.h |
| 6 | [main.cpp](upstream/main/main.cpp) | [1035-1035](upstream/main/main.cpp.excerpt) | engine/godot-4.7/main/main.cpp |
| 7 | [methods.py](upstream/methods.py) | [136-165](upstream/methods.py.excerpt) | engine/godot-4.7/methods.py |
| 8 | [scene_tree.cpp](upstream/scene/main/scene_tree.cpp) | [688-688](upstream/scene/main/scene_tree.cpp.excerpt) | engine/godot-4.7/scene/main/scene_tree.cpp |
| 9 | [version.py](upstream/version.py) | [1-9](upstream/version.py.excerpt) | engine/godot-4.7/version.py |

## GDScript 复刻

source_replay.gd 只模拟本课选定的控制流和状态变化。它按 Godot 大版本分别编写，不是引擎实现，也不替代静态 C++ 源码。

## 证据边界

完整 C++ 文件和摘录来自指定本地快照；GDScript 是教学模型；根目录 probe 调用的是对应版本公开 API。源码阅读、模型输出与实际 Godot 运行结果分别记录。
