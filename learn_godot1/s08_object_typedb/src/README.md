# 本课源码副本与 GDScript 复刻模型

课程版本：godot-1.1。engine/ 快照保持只读；upstream/ 保存本课引用文件的完整字节副本，摘录按原始行号从这些副本生成。

阅读顺序：先按课程 README 的 C++ 调用链进入函数，再打开完整文件查看上下文；摘录只负责快速定位，不替代源文件。

## 完整副本校验

在本目录执行 shasum -a 256 -c SOURCE_SHA256.txt。清单覆盖所有完整上游副本，不覆盖派生摘录。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [object.cpp](upstream/core/object.cpp) | [1435-1438](upstream/core/object.cpp.excerpt) | engine/godot-1.1/core/object.cpp |
| 2 | [object_type_db.cpp](upstream/core/object_type_db.cpp) | [272-296 ; 300-317](upstream/core/object_type_db.cpp.excerpt) | engine/godot-1.1/core/object_type_db.cpp |
| 3 | [object_type_db.h](upstream/core/object_type_db.h) | [195-204](upstream/core/object_type_db.h.excerpt) | engine/godot-1.1/core/object_type_db.h |
| 4 | [gd_script.cpp](upstream/modules/gdscript/gd_script.cpp) | [1422-1448](upstream/modules/gdscript/gd_script.cpp.excerpt) | engine/godot-1.1/modules/gdscript/gd_script.cpp |
| 5 | [node_2d.h](upstream/scene/2d/node_2d.h) | [34-36](upstream/scene/2d/node_2d.h.excerpt) | engine/godot-1.1/scene/2d/node_2d.h |
| 6 | [register_scene_types.cpp](upstream/scene/register_scene_types.cpp) | [231-266](upstream/scene/register_scene_types.cpp.excerpt) | engine/godot-1.1/scene/register_scene_types.cpp |

## GDScript 复刻

source_replay.gd 只模拟本课选定的控制流和状态变化。它按 Godot 大版本分别编写，不是引擎实现，也不替代静态 C++ 源码。

## 证据边界

完整 C++ 文件和摘录来自指定本地快照；GDScript 是教学模型；根目录 probe 调用的是对应版本公开 API。源码阅读、模型输出与实际 Godot 运行结果分别记录。
