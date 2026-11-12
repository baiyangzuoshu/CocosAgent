# 第 0 课：源码快照与目录地图

**目标：** 确认课程使用的 Godot 源码快照版本，比较本机运行时版本，并找到后续课程会追踪的源码区域。

## 本课问题

本地源码标记的版本是什么？当前启动项目的 Godot 二进制是否对应这个版本？引擎源码的主要职责分布在哪些目录？

## 源码对照

以下路径相对于仓库根目录：

- `engine/godot-master/version.py`：快照版本元数据，当前标记为 4.8.0 beta。
- `engine/godot-master/core/config/engine.cpp:158`：原生 `Engine::get_version_info()` 组织运行时版本字段。
- `engine/godot-master/core/core_bind.cpp:1975-1976`：将版本信息方法绑定给脚本可访问的 `Engine` 对象。
- `engine/godot-master/main/main.cpp:986`、`4056`、`4967`：`Main::setup()`、`Main::start()` 和 `Main::iteration()` 的入口位置。
- `engine/godot-master/scene/main/scene_tree.cpp:689`：`SceneTree::process()` 的入口。

版本实验读取 `Engine.get_version_info()` 的结果，并与 `version.py` 中的 major、minor、patch、status 对照。

## 源码目录地图

| 目录 | 本课程中的导航用途 |
| --- | --- |
| `main/` | 应用启动、初始化和主循环入口 |
| `core/object/`、`core/variant/` | 对象、类型和值系统 |
| `core/io/`、`scene/resources/` | 资源加载、保存和场景资源 |
| `scene/main/`、`scene/2d/`、`scene/3d/` | 场景树、节点和 2D/3D 场景对象 |
| `servers/` | 渲染、物理、音频、导航等服务接口 |
| `drivers/`、`platform/` | 图形/设备驱动与平台接入 |
| `modules/gdscript/` | GDScript 语言实现 |
| `editor/` | 编辑器和资源导入工作流 |
| `tests/`、`thirdparty/` | 引擎测试与第三方依赖 |

这是后续阅读的目录索引，不表示这些模块都在同一帧或同一条调用链中。具体关系在相应课次沿源码确认。

## 实验文件

- `project.godot`：独立 Godot 项目入口。
- `main.tscn`：启动场景。
- `source_map.gd`：打印本机运行时版本，并比较 4.8.0 beta 版本字段。

## 运行

在 Godot 编辑器中打开本目录的 `project.godot`，按 F5 运行项目；也可在本目录使用已安装的 Godot 命令行程序运行项目。运行前确认本机程序版本，并将实际版本和源码快照版本分开记录。

## 观察结果

输出面板会显示源码快照版本、本机运行时版本及版本字段是否匹配。若结果为不匹配，表示当前运行的二进制与本地源码快照版本不同；不要把该运行结果当作 Godot 4.8.0 beta 的运行时验证。

然后从源码中定位 `Main::setup()`、`Main::iteration()`、`SceneTree::process()`，并把它们分别归入启动链和帧推进链的阅读笔记。目录地图只帮助找到入口，后续课程再展开调用关系。

## 简化与边界

本课不编译 Godot 引擎，也不推断本机可执行文件来自 `engine/godot-master/`。版本字段只能确认版本号和状态；若要确认二进制与源码提交完全一致，还需比对构建信息或提交标识。本课的目录职责是导航提示，具体实现以对应版本源码为准。
