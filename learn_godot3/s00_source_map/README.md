# 第 0 课：源码快照与目录地图

**目标：** 确认课程使用的 Godot 3.6.4-rc 源码快照版本，追踪版本信息从构建宏进入 GDScript 的路径，并定位后续课程会追踪的源码区域。

## 本课增量

建立本代源码地图：把 version.py、构建宏和脚本可见版本查询串起来，并区分版本元数据与本机二进制证据。

**本课要回答：** `Engine.get_version_info()` 的字段从哪里来？C++ 包装层如何将它暴露给 GDScript？主循环和场景树入口分别在哪些源码目录？

## C++ 源码追踪

源码依据：`engine/godot-3.6/`（Godot 3.6 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于仓库根目录：

- `engine/godot-3.6/version.py`：快照标记为 3.6.4-rc。
- `engine/godot-3.6/methods.py:235-252`：读取版本模块并生成版本宏头文件。
- `engine/godot-3.6/core/engine.cpp:89-109`：原生 `Engine::get_version_info()` 组装版本 Dictionary。
- `engine/godot-3.6/core/bind/core_bind.cpp:3212-3214`、`3283-3284`：脚本包装层转发并绑定查询方法。
- `engine/godot-3.6/core/register_core_types.cpp:261-274`：把包装对象以 `Engine` 名称注册为脚本单例。
- `engine/godot-3.6/main/main.cpp:418`、`1682`、`2304`：`Main::setup()`、`Main::start()`、`Main::iteration()` 入口。
- `engine/godot-3.6/scene/main/scene_tree.cpp:578`、`621`：`SceneTree::iteration()` 和 `SceneTree::idle()`。

版本查询调用链：`version.py` → 构建期版本宏 → 原生 `Engine::get_version_info()` → CoreBind 包装/绑定 → `Engine` 单例注册 → GDScript。实验比较 major/minor/patch/status；匹配不代表二进制与源码来自同一提交。

## 源码目录地图

| 目录 | 本课程中的导航用途 |
| --- | --- |
| `main/`、`platform/` | 平台入口、初始化和帧循环 |
| `core/`、`core/bind/` | Object、ClassDB、Variant、Reference 与绑定层 |
| `core/io/`、`scene/resources/` | 资源加载、序列化和 PackedScene |
| `scene/main/`、`scene/2d/`、`scene/3d/` | SceneTree、节点和场景对象 |
| `servers/`、`drivers/` | VisualServer、物理、音频、导航及渲染后端 |
| `modules/gdscript/` | GDScript 解析、类型检查和执行 |
| `editor/`、`editor/import/`、`editor/plugins/` | 编辑器、资源导入器和编辑器插件 |
| `modules/gdnative/` | GDNative/NativeScript 边界 |

目录只帮助定位源码；具体调用顺序在相应课次按源码确认。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [core_bind.cpp](src/upstream/core/bind/core_bind.cpp) | [3212-3214](src/upstream/core/bind/core_bind.cpp.excerpt) | engine/godot-3.6/core/bind/core_bind.cpp |
| 2 | [engine.cpp](src/upstream/core/engine.cpp) | [89-109](src/upstream/core/engine.cpp.excerpt) | engine/godot-3.6/core/engine.cpp |
| 3 | [register_core_types.cpp](src/upstream/core/register_core_types.cpp) | [261-274](src/upstream/core/register_core_types.cpp.excerpt) | engine/godot-3.6/core/register_core_types.cpp |
| 4 | [main.cpp](src/upstream/main/main.cpp) | [418-418](src/upstream/main/main.cpp.excerpt) | engine/godot-3.6/main/main.cpp |
| 5 | [methods.py](src/upstream/methods.py) | [235-252](src/upstream/methods.py.excerpt) | engine/godot-3.6/methods.py |
| 6 | [scene_tree.cpp](src/upstream/scene/main/scene_tree.cpp) | [578-578](src/upstream/scene/main/scene_tree.cpp.excerpt) | engine/godot-3.6/scene/main/scene_tree.cpp |
| 7 | [version.py](src/upstream/version.py) | [1-10](src/upstream/version.py.excerpt) | engine/godot-3.6/version.py |

## GDScript 源码复刻

S00 Godot 3.6: build version macros are exposed through Engine.get_version_info().

source_replay.gd 按本课指定快照复刻控制流与状态传递，模型中的状态字段、函数入口和 API 名称对应本代 C++ 路径。根目录实验脚本先运行模型，再调用对应版本的 Godot API。

| GDScript 函数 | 复刻步骤 |
| --- | --- |
| _build_macros() | 把 version.py 字段写入生成宏记录 |
| _engine_version_info() | 模拟本代 OS/Engine 脚本接口返回值 |

## 最小 Godot/GDScript 实验

- `project.godot`：Godot 3.6 项目入口，配置版本为 4。
- `main.tscn`：format 2 的最小文本场景。
- `source_map.gd`：读取版本信息并与 3.6.4-rc 对照。

## 运行与观察

使用 Godot 3.6 编辑器打开本目录的 `project.godot` 并按 F5；也可在本目录使用 Godot 3.6 命令行程序运行项目。

输出源码快照版本、本机运行时字符串、四个字段和匹配结果。若使用其他 Godot 3 版本，匹配结果应为 `false`；请记录实际工具版本，不要将其标记为 3.6.4-rc 的运行时验证。

## 简化与边界

本课不编译 Godot 引擎，不检查二进制哈希或构建提交。GDScript 只观察本机引擎暴露的版本信息；C++ 调用链以 `engine/godot-3.6/` 快照为准。

## 下一课

继续阅读 [s01_platform_entry](../s01_platform_entry/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
