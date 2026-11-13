# 第 0 课：源码快照与目录地图

**目标：** 确认课程使用的 Godot 4.7.3-rc 源码快照版本，比较本机运行时版本，并找到后续课程会追踪的源码区域。

## 本课问题

本地源码标记的版本是什么？当前启动项目的 Godot 二进制是否对应这个版本？引擎源码的主要职责分布在哪些目录？

## 源码对照

以下路径相对于仓库根目录：

- `engine/godot-4.7/version.py`：快照版本元数据，标记为 4.7.3-rc。
- `engine/godot-4.7/methods.py:136-165`：读取 `version.py` 并组成构建期版本字段。
- `engine/godot-4.7/core/SCsub:176-180`、`core/core_builders.py:17-34`：把版本字段生成到 `version_generated.gen.h`；`core/version.h:33` 引入生成头文件。
- `engine/godot-4.7/core/config/engine.cpp:153-174`：原生 `Engine::get_version_info()` 将编译期宏组成 Dictionary。
- `engine/godot-4.7/core/core_bind.cpp:1959-1960`、`2120`：脚本包装层转发调用，并将方法绑定到类。
- `engine/godot-4.7/core/register_core_types.cpp:364-369`：将脚本可访问对象以 `Engine` 名称注册为单例。
- `engine/godot-4.7/main/main.cpp:1035`、`4013`、`4921`：`Main::setup()`、`Main::start()` 和 `Main::iteration()` 的入口位置；`Main::iteration()` 在 `5001`、`5062` 推进主循环的物理和帧处理。
- `engine/godot-4.7/scene/main/scene_tree.cpp:688`：`SceneTree::process()` 覆盖主循环的逐帧处理入口。

版本查询调用链：`version.py` → 构建脚本生成版本宏 → 原生 `Engine::get_version_info()` → CoreBind 包装及 `Engine` 单例注册 → GDScript `Engine.get_version_info()`。实验只比较 `major`、`minor`、`patch`、`status` 四个字段；即使匹配，也不能据此证明运行二进制和源码来自同一提交。

主循环入口是另一条阅读线：平台启动后进入 `Main` 初始化和主场景启动；`Main::iteration()` 按物理步长推进主循环，`SceneTree::process()` 处理场景树的帧更新。目录图只标入口，具体顺序以对应函数中的调用为准。

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
- `source_map.gd`：打印本机运行时版本，并比较 4.7.3-rc 版本字段。

## 运行

在 Godot 编辑器中打开本目录的 `project.godot`，按 F5 运行项目；也可在本目录使用已安装的 Godot 命令行程序运行项目。运行前确认本机程序版本，并将实际版本和源码快照版本分开记录。

## 观察结果

1. 用 Godot 4 编辑器打开本目录的 `project.godot`，按 F5 运行；或使用本机 Godot 命令行程序启动项目。
2. 在输出面板查看源码快照版本、本机运行时版本、四个版本字段和匹配结果。
3. 记录实际工具版本。只有运行时字段为 `4.7.3-rc` 时，匹配结果才为 `true`；若不匹配，这次运行只能验证当前本机二进制的行为，不能当作 Godot 4.7.3-rc 的运行时验证。

然后从源码中定位 `Main::setup()`、`Main::start()`、`Main::iteration()`、`SceneTree::process()`，把前三者记入启动/帧循环索引，并指出 `Main::iteration()` 通过当前 `MainLoop` 推进逐帧处理。

## 简化与边界

本课不编译 Godot 引擎，也不推断本机可执行文件来自 `engine/godot-4.7/`。版本字段只能确认版本号和状态；若要确认二进制与源码提交完全一致，还需比对构建信息或提交标识。本课的目录职责是导航提示，具体实现以对应版本源码为准。
