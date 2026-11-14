# 第 0 课：源码快照与目录地图

**目标：** 确认课程使用的 Godot 2.1.7-rc 源码快照版本，通过 2.1 的 `OS.get_engine_version()` 观察运行时版本，并定位后续课程的主要源码区域。

## 本课增量

建立本代源码地图：把 version.py、构建宏和脚本可见版本查询串起来，并区分版本元数据与本机二进制证据。

**本课要回答：** 构建系统如何把 `version.py` 转成 C++ 版本宏？GDScript 如何经 OS 单例查询这些版本字段？2.1 项目的配置文件和文本场景格式是什么？

## C++ 源码追踪

源码依据：`engine/godot-2.1/`（Godot 2.1 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于仓库根目录：

- `engine/godot-2.1/version.py`：快照标记为 2.1.7-rc。
- `engine/godot-2.1/methods.py:1089-1109`：构建时读取 `version.py` 并生成 `core/version_generated.gen.h` 中的版本宏。
- `engine/godot-2.1/core/version.h:31-38`：引入生成头文件并组成版本标识。
- `engine/godot-2.1/core/os/os.cpp:528-547`：`OS::get_engine_version()` 从编译宏组装版本 Dictionary；字段值以字符串返回。
- `engine/godot-2.1/core/bind/core_bind.cpp:1020-1023`、`1182`：包装并绑定 `OS.get_engine_version()`。
- `engine/godot-2.1/scene/resources/scene_format_text.cpp:37`、`engine/godot-2.1/scene/resources/scene_format_text.cpp:1321-1339`：文本场景格式版本为 1，加载器识别 `.tscn`。
- `engine/godot-2.1/main/main.cpp`、`engine/godot-2.1/scene/main/scene_main_loop.cpp`：应用入口、主帧迭代和 SceneTree 调度。

版本调用链是：`version.py` → 构建期版本宏 → `OS::get_engine_version()` → OS 脚本包装和绑定 → GDScript `OS.get_engine_version()`。实验比较 major/minor/patch/status，不比较 revision、构建名或源码提交。

## 源码目录地图

| 目录 | 本课程中的导航用途 |
| --- | --- |
| `main/`、`platform/` | 启动参数、平台入口和帧调度 |
| `core/`、`core/bind/`、`core/os/` | ObjectTypeDB、Variant、OS 和脚本绑定 |
| `modules/gdscript/` | GDScript tokenizer、parser、compiler 和执行 |
| `scene/main/`、`scene/2d/`、`scene/3d/` | SceneTree、Node、Viewport 和场景对象 |
| `scene/resources/`、`scene/animation/` | 资源、PackedScene、动画资源和播放器 |
| `servers/`、`drivers/` | VisualServer、物理/音频服务与后端 |
| `editor/`、`editor/io_plugins/` | 编辑器、资源导入和导出工作流 |

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [core_bind.cpp](src/upstream/core/bind/core_bind.cpp) | [1020-1023](src/upstream/core/bind/core_bind.cpp.excerpt) | engine/godot-2.1/core/bind/core_bind.cpp |
| 2 | [os.cpp](src/upstream/core/os/os.cpp) | [528-547](src/upstream/core/os/os.cpp.excerpt) | engine/godot-2.1/core/os/os.cpp |
| 3 | [version.h](src/upstream/core/version.h) | [31-38](src/upstream/core/version.h.excerpt) | engine/godot-2.1/core/version.h |
| 4 | [methods.py](src/upstream/methods.py) | [1089-1109](src/upstream/methods.py.excerpt) | engine/godot-2.1/methods.py |
| 5 | [scene_format_text.cpp](src/upstream/scene/resources/scene_format_text.cpp) | [37-37 ; 1321-1339](src/upstream/scene/resources/scene_format_text.cpp.excerpt) | engine/godot-2.1/scene/resources/scene_format_text.cpp |
| 6 | [version.py](src/upstream/version.py) | [1-6](src/upstream/version.py.excerpt) | engine/godot-2.1/version.py |

## GDScript 源码复刻

S00 Godot 2.1: generated version fields flow through OS into GDScript.

source_replay.gd 按本课指定快照复刻控制流与状态传递，模型中的状态字段、函数入口和 API 名称对应本代 C++ 路径。根目录实验脚本先运行模型，再调用对应版本的 Godot API。

| GDScript 函数 | 复刻步骤 |
| --- | --- |
| _generated_version_macros() | 把 version.py 字段写入生成宏记录 |
| _os_engine_version() | 模拟本代 OS/Engine 脚本接口返回值 |

## 最小 Godot/GDScript 实验

- `engine.cfg`：Godot 2.1 项目入口和主场景配置。
- `main.tscn`：format 1 的最小文本场景，挂接版本查询脚本。
- `source_map.gd`：输出运行时版本并比较四个字段。

## 运行与观察

使用 Godot 2.1 工具打开本目录的 `engine.cfg`，运行主场景；也可在本目录使用兼容的 Godot 2.1 命令行程序启动项目。

输出 `Source snapshot: Godot 2.1.7-rc`、运行时字符串和字段匹配结果。匹配说明运行时报告的四个版本字段与课程快照标记相同；它不证明二进制和源码来自同一提交。

## 简化与边界

项目配置和场景格式都按 Godot 2.1 快照组织。不要用 Godot 3/4 的 `Engine.get_version_info()`、`project.godot` 或新版场景格式解释本实验。

## 下一课

继续阅读 [s01_platform_entry](../s01_platform_entry/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
