# 本课源码副本与 GDScript 复刻模型

课程版本：godot-1.1。engine/ 快照保持只读；upstream/ 保存本课引用文件的完整字节副本，摘录按原始行号从这些副本生成。

阅读顺序：先按课程 README 的 C++ 调用链进入函数，再打开完整文件查看上下文；摘录只负责快速定位，不替代源文件。

## 完整副本校验

在本目录执行 shasum -a 256 -c SOURCE_SHA256.txt。清单覆盖所有完整上游副本，不覆盖派生摘录。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [main.cpp](upstream/main/main.cpp) | [778-784 ; 792-835 ; 837-856 ; 869-874](upstream/main/main.cpp.excerpt) | engine/godot-1.1/main/main.cpp |
| 2 | [register_server_types.cpp](upstream/servers/register_server_types.cpp) | [39-66](upstream/servers/register_server_types.cpp.excerpt) | engine/godot-1.1/servers/register_server_types.cpp |
| 3 | [visual_server.cpp](upstream/servers/visual_server.cpp) | [562-562](upstream/servers/visual_server.cpp.excerpt) | engine/godot-1.1/servers/visual_server.cpp |

## GDScript 复刻

source_replay.gd 只模拟本课选定的控制流和状态变化。它按 Godot 大版本分别编写，不是引擎实现，也不替代静态 C++ 源码。

## 证据边界

完整 C++ 文件和摘录来自指定本地快照；GDScript 是教学模型；根目录 probe 调用的是对应版本公开 API。源码阅读、模型输出与实际 Godot 运行结果分别记录。
