# 第 0 课：源码快照与目录地图

**目标：** 确认课程使用的 Godot 3.6.4-rc 源码快照版本，追踪版本信息从构建宏进入 GDScript 的路径，并定位后续课程会追踪的源码区域。

## 本课增量

建立本代源码地图：把 version.py、构建宏和脚本可见版本查询串起来，并区分版本元数据与本机二进制证据。

## 本课问题

`Engine.get_version_info()` 的字段从哪里来？C++ 包装层如何将它暴露给 GDScript？主循环和场景树入口分别在哪些源码目录？

## 源码调用链

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

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-3.6` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [core_bind.cpp](src/upstream/core/bind/core_bind.cpp) | [摘录](src/upstream/core/bind/core_bind.cpp.excerpt) | `engine/godot-3.6/core/bind/core_bind.cpp` | 3212-3214 |
| 2 | [engine.cpp](src/upstream/core/engine.cpp) | [摘录](src/upstream/core/engine.cpp.excerpt) | `engine/godot-3.6/core/engine.cpp` | 89-109 |
| 3 | [register_core_types.cpp](src/upstream/core/register_core_types.cpp) | [摘录](src/upstream/core/register_core_types.cpp.excerpt) | `engine/godot-3.6/core/register_core_types.cpp` | 261-274 |
| 4 | [main.cpp](src/upstream/main/main.cpp) | [摘录](src/upstream/main/main.cpp.excerpt) | `engine/godot-3.6/main/main.cpp` | 418-418 |
| 5 | [methods.py](src/upstream/methods.py) | [摘录](src/upstream/methods.py.excerpt) | `engine/godot-3.6/methods.py` | 235-252 |
| 6 | [scene_tree.cpp](src/upstream/scene/main/scene_tree.cpp) | [摘录](src/upstream/scene/main/scene_tree.cpp.excerpt) | `engine/godot-3.6/scene/main/scene_tree.cpp` | 578-578 |
| 7 | [version.py](src/upstream/version.py) | [摘录](src/upstream/version.py.excerpt) | `engine/godot-3.6/version.py` | 1-10 |

## GDScript 源码复刻与 C++ 对照

模型从版本字段重建显示名，标出这一代的脚本查询入口，再打印源码目录职责。源码快照和本机运行二进制由独立实验分别确认。

src/upstream/ 保存本课引用的完整上游文件副本和带原始行号的摘录；src/source_replay.gd 执行表中的教学模型。先观察模型如何改变状态或走分支，再回到对应 C++ 函数核对。模型不替代 C++，也不代表引擎运行时本身。

| C++ 追踪阶段 | 模型函数 | 运行时要观察什么 |
| --- | --- | --- |
| version.py → methods.py → generated version fields | _version_fields() → _compiled_full_name() | 重建编译期版本字符串和字段 |
| typedefs.h / Engine 或 OS binding | _script_version_bridge() → _runtime_version_string() | 区分脚本查询入口及返回字符串格式 |
| core/main/scene/servers/platform | _print_source_map() | 打印源码职责导航，不伪造调用栈 |

独立项目入口先调用 source_replay.gd，再执行真实 Godot API 实验。实验脚本：source_map.gd。模型输出是确定性的教学数据；只有实际用对应版本 Godot 运行后，才能记录为引擎实验验证。
## 最小 Godot/GDScript 实验

- `project.godot`：Godot 3.6 项目入口，配置版本为 4。
- `main.tscn`：format 2 的最小文本场景。
- `source_map.gd`：读取版本信息并与 3.6.4-rc 对照。

## 运行与预期观察

使用 Godot 3.6 编辑器打开本目录的 `project.godot` 并按 F5；也可在本目录使用 Godot 3.6 命令行程序运行项目。

输出源码快照版本、本机运行时字符串、四个字段和匹配结果。若使用其他 Godot 3 版本，匹配结果应为 `false`；请记录实际工具版本，不要将其标记为 3.6.4-rc 的运行时验证。

## 简化与边界

本课不编译 Godot 引擎，不检查二进制哈希或构建提交。GDScript 只观察本机引擎暴露的版本信息；C++ 调用链以 `engine/godot-3.6/` 快照为准。

## 下一课

继续阅读 [s01_platform_entry](../s01_platform_entry/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
