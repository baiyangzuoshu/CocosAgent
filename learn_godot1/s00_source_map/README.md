# 第 0 课：源码快照与目录地图

**目标：** 确认课程使用的 Godot 1.1 源码快照版本，找到该版本显示运行时版本的位置，并定位后续课程会追踪的源码区域。

## 本课增量

建立本代源码地图：把 version.py、构建宏和脚本可见版本查询串起来，并区分版本元数据与本机二进制证据。

**本课要回答：** Godot 1.1 如何把版本元数据编译进引擎？这个版本为什么不能像 Godot 3/4 一样从 GDScript 调用版本字典？用什么最小脚本确认旧版脚本运行路径？

## C++ 源码追踪

源码依据：`engine/godot-1.1/`（Godot 1.1 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于仓库根目录：

- `engine/godot-1.1/version.py`：快照标记为 major 1、minor 1、stable；此文件没有 patch 字段。
- `engine/godot-1.1/methods.py:1085-1102`：构建时读取版本模块并生成 `VERSION_MAJOR`、`VERSION_MINOR`、`VERSION_STATUS` 等宏。
- `engine/godot-1.1/core/typedefs.h:44-45`：用这些宏组成 `VERSION_MKSTRING` 和 `VERSION_FULL_NAME`。
- `engine/godot-1.1/main/main.cpp:117`、`engine/godot-1.1/tools/editor/project_manager.cpp:840`：命令行帮助和 Project Manager 显示构建版本。
- 本快照的 OS 脚本绑定提供 `OS.get_name()`，但没有 `Engine.get_version_info()` 或 `OS.get_engine_version()`。因此版本确认要看本代工具标识，脚本实验只报告平台。
- `engine/godot-1.1/main/main.cpp:911-913`、`1012-1033`：`-s`/`-script` 加载脚本，并要求脚本实例继承 `MainLoop`。
- `engine/godot-1.1/core/os/main_loop.cpp:71-87`：MainLoop 安装脚本后调用 `init` 和脚本 `iteration`。

版本显示和脚本实验是两条证据：`version.py` 描述本地源码快照；工具界面/启动标识描述实际运行的二进制。不要把本地源码标记当成运行时版本证明。

## 源码目录地图

| 目录 | 本课程中的导航用途 |
| --- | --- |
| `main/`、`platform/` | 可执行程序入口、平台启动和主循环调度 |
| `core/`、`core/os/` | 对象、Variant、资源、OS 接口和 MainLoop |
| `modules/gdscript/` | 旧版 GDScript tokenizer、parser、编译和执行 |
| `scene/main/`、`scene/2d/`、`scene/3d/` | SceneTree、节点、Viewport 和场景对象 |
| `scene/resources/`、`scene/animation/` | PackedScene、资源及动画节点 |
| `servers/`、`drivers/` | VisualServer、PhysicsServer、AudioServer 与具体后端 |
| `tools/editor/`、`tools/export/` | 编辑器、资源导入和平台导出 |

目录只表示源码职责导航，不表示它们会在同一个调用栈里直接相连。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [main_loop.cpp](src/upstream/core/os/main_loop.cpp) | [71-87](src/upstream/core/os/main_loop.cpp.excerpt) | engine/godot-1.1/core/os/main_loop.cpp |
| 2 | [typedefs.h](src/upstream/core/typedefs.h) | [44-45](src/upstream/core/typedefs.h.excerpt) | engine/godot-1.1/core/typedefs.h |
| 3 | [main.cpp](src/upstream/main/main.cpp) | [117-117 ; 911-913](src/upstream/main/main.cpp.excerpt) | engine/godot-1.1/main/main.cpp |
| 4 | [methods.py](src/upstream/methods.py) | [1085-1102](src/upstream/methods.py.excerpt) | engine/godot-1.1/methods.py |
| 5 | [project_manager.cpp](src/upstream/tools/editor/project_manager.cpp) | [840-840](src/upstream/tools/editor/project_manager.cpp.excerpt) | engine/godot-1.1/tools/editor/project_manager.cpp |
| 6 | [version.py](src/upstream/version.py) | [1-7](src/upstream/version.py.excerpt) | engine/godot-1.1/version.py |

## GDScript 源码复刻

S00 Godot 1.1: version.py → generated build macros → old script surface.

source_replay.gd 按本课指定快照复刻控制流与状态传递，模型中的状态字段、函数入口和 API 名称对应本代 C++ 路径。根目录实验脚本先运行模型，再调用对应版本的 Godot API。

| GDScript 函数 | 复刻步骤 |
| --- | --- |
| _snapshot_fields() | 读取本课快照的 major/minor/status 字段；Godot 1.1 没有 patch 字段 |
| _generated_version_macros() | 把 version.py 字段写入生成宏记录 |
| _script_version_query() | 模拟本代 OS/Engine 脚本接口返回值 |
| _source_areas() | 列出课程后续会继续追踪的源码目录 |

## 最小 Godot/GDScript 实验

- `engine.cfg`：Godot 1.1 项目标识；本实验使用脚本 MainLoop，不配置场景文件。
- `source_map.gd`：在 `init()` 打印源码快照和运行平台，随后由 `iteration()` 结束本次运行。

## 运行与观察

在本目录使用 Godot 1.1 命令行程序运行：

```sh
godot -path . -s res://source_map.gd
```

命令中的 `-s` 对应源码中加载 MainLoop 脚本的分支。若要确认二进制的实际版本，另看 Godot 1.1 工具启动标识或 Project Manager 版本标签；本实验脚本不会伪造一个不存在的版本查询 API。

输出包含 `Godot 1.1 stable`、当前平台名，以及提示通过旧版工具标识确认运行时版本。确认 `iteration()` 返回 `true` 后程序结束；这同时验证了脚本被作为 MainLoop 执行。

## 简化与边界

本课不编译引擎、不生成二进制场景，也不验证各平台构建。版本显示只用于确认运行二进制报告的版本字符串；若要对齐某个源码提交，还需要构建信息或提交标识。

## 下一课

继续阅读 [s01_platform_entry](../s01_platform_entry/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
