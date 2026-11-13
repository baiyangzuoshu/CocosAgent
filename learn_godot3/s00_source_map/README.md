# 第 0 课：源码快照与目录地图

**目标：** 确认课程使用的 Godot 3.6.4-rc 源码快照版本，追踪版本信息从构建宏进入 GDScript 的路径，并定位后续课程会追踪的源码区域。

## 本课问题

`Engine.get_version_info()` 的字段从哪里来？C++ 包装层如何将它暴露给 GDScript？主循环和场景树入口分别在哪些源码目录？

## 源码对照

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

## 实验文件

- `project.godot`：Godot 3.6 项目入口，配置版本为 4。
- `main.tscn`：format 2 的最小文本场景。
- `source_map.gd`：读取版本信息并与 3.6.4-rc 对照。

## 运行

使用 Godot 3.6 编辑器打开本目录的 `project.godot` 并按 F5；也可在本目录使用 Godot 3.6 命令行程序运行项目。

## 观察结果

输出源码快照版本、本机运行时字符串、四个字段和匹配结果。若使用其他 Godot 3 版本，匹配结果应为 `false`；请记录实际工具版本，不要将其标记为 3.6.4-rc 的运行时验证。

## 简化与边界

本课不编译 Godot 引擎，不检查二进制哈希或构建提交。GDScript 只观察本机引擎暴露的版本信息；C++ 调用链以 `engine/godot-3.6/` 快照为准。

## 本课 C++ 源码摘录

课内摘录保留对应 Godot 源码行段正文，并在段首标出原始行号；完整上下文以只读的 engine 快照为准。摘录用于追踪，不是独立编译单元。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | Godot 源文件 | 上游行段 |
| --- | --- | --- |
| [core_bind.cpp](src/upstream/core/bind/core_bind.cpp.excerpt) | godot-3.6/core/bind/core_bind.cpp | 3212-3214 |
| [engine.cpp](src/upstream/core/engine.cpp.excerpt) | godot-3.6/core/engine.cpp | 89-109 |
| [register_core_types.cpp](src/upstream/core/register_core_types.cpp.excerpt) | godot-3.6/core/register_core_types.cpp | 261-274 |
| [main.cpp](src/upstream/main/main.cpp.excerpt) | godot-3.6/main/main.cpp | 418-418 |
| [methods.py](src/upstream/methods.py.excerpt) | godot-3.6/methods.py | 235-252 |
| [scene_tree.cpp](src/upstream/scene/main/scene_tree.cpp.excerpt) | godot-3.6/scene/main/scene_tree.cpp | 578-578 |
| [version.py](src/upstream/version.py.excerpt) | godot-3.6/version.py | 1-10 |
