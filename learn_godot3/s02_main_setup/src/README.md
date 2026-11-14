# 本课源码副本与 GDScript 复刻模型

课程版本：godot-3.6。engine/ 快照保持只读；upstream/ 保存本课引用文件的完整字节副本，摘录按原始行号从这些副本生成。

阅读顺序：先按课程 README 的 C++ 调用链进入函数，再打开完整文件查看上下文；摘录只负责快速定位，不替代源文件。

## 完整副本校验

在本目录执行 shasum -a 256 -c SOURCE_SHA256.txt。清单覆盖所有完整上游副本，不覆盖派生摘录。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [core_bind.cpp](upstream/core/bind/core_bind.cpp) | [573-580](upstream/core/bind/core_bind.cpp.excerpt) | engine/godot-3.6/core/bind/core_bind.cpp |
| 2 | [os.cpp](upstream/core/os/os.cpp) | [503-506](upstream/core/os/os.cpp.excerpt) | engine/godot-3.6/core/os/os.cpp |
| 3 | [os.h](upstream/core/os/os.h) | [386-386](upstream/core/os/os.h.excerpt) | engine/godot-3.6/core/os/os.h |
| 4 | [main.cpp](upstream/main/main.cpp) | [418-461 ; 481-481 ; 982-984 ; 1018-1028 ; 1357-1361](upstream/main/main.cpp.excerpt) | engine/godot-3.6/main/main.cpp |

## GDScript 复刻

source_replay.gd 只模拟本课选定的控制流和状态变化。它按 Godot 大版本分别编写，不是引擎实现，也不替代静态 C++ 源码。

## 证据边界

完整 C++ 文件和摘录来自指定本地快照；GDScript 是教学模型；根目录 probe 调用的是对应版本公开 API。源码阅读、模型输出与实际 Godot 运行结果分别记录。
