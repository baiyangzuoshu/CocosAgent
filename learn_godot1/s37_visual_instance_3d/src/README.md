# 本课源码副本与 GDScript 复刻模型

课程版本：`godot-1.1`（1.1 stable）。engine 快照保持只读；`upstream/` 保存本课引用文件的完整字节副本，摘录按原始行号从这些副本生成。

阅读顺序：先看课程 README 中的 C++ 调用链和函数解释，再按顺序读摘录；回到完整文件检查类成员、调用者及分支上下文。

## 完整副本校验

在本目录执行 `shasum -a 256 -c SOURCE_SHA256.txt`。清单覆盖所有完整上游副本，不覆盖派生摘录。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [visual_instance.cpp](upstream/scene/3d/visual_instance.cpp) | [44-100, 137-140](upstream/scene/3d/visual_instance.cpp.excerpt) | `engine/godot-1.1/scene/3d/visual_instance.cpp` |
| 2 | [visual_server_raster.cpp](upstream/servers/visual/visual_server_raster.cpp) | [2039-2050, 2052-2259, 2425-2438](upstream/servers/visual/visual_server_raster.cpp.excerpt) | `engine/godot-1.1/servers/visual/visual_server_raster.cpp` |

## GDScript 复刻

`source_replay.gd` 按本代 C++ 调用链模拟关键字段变化；它不是引擎实现。根目录 `probe.gd` 在模型之后调用该版本的公开 API 实验。源码静态阅读、模型输出和真实引擎运行是三类不同证据。
