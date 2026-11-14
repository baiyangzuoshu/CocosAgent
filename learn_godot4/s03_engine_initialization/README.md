# 第 3 课：引擎类型注册与服务器初始化

**目标：** 追踪 Godot 4.7 `Main::setup2()` 中服务器类注册、场景类注册和服务单例发布的阶段顺序，并用 GDScript 检查公开类型和渲染服务。

## 本课增量

把类型注册和脚本单例发布拆成两张表，按本代 setup2 顺序填充代表类与服务器服务。

**本课要回答：** 服务器类何时进入 ClassDB？`RenderingServer` 单例又何时对脚本发布？物理/导航初始化与场景注册之间的边界是什么？

## C++ 源码追踪

源码依据：`engine/godot-4.7/`（Godot 4.7 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-4.7/` 快照根目录：

- `main/main.cpp:1016-1032`：源码将初始化划分为 `setup()`、`setup2()`、`start()`；其中 `setup2()` 注册高层服务器、单例和场景/编辑器类型。
- `main/main.cpp:3033-3041`：`Main::setup2()` 启动第二阶段并建立阶段统计。
- `main/main.cpp:3212-3229`、`servers/register_server_types.cpp:146-170`：创建导航服务管理器并调用 `register_server_types()`，后者把服务类注册到 ClassDB 并注册 TextServerManager 等单例。
- `main/main.cpp:3776-3795`：初始化导航服务，注册场景类型和场景单例，再初始化场景级模块。
- `main/main.cpp:3858-3867`：创建相机服务、初始化物理服务，随后调用 `register_server_singletons()` 并初始化脚本语言。
- `servers/register_server_types.cpp:393-418`：将 RenderingServer、AudioServer、DisplayServer、PhysicsServer 等实例发布为 Engine 单例；具体项受编译选项控制。
- `servers/rendering/rendering_server.cpp:3511`、`3543-3545`：绑定 `get_rendering_info()` 与帧统计枚举；`core/core_bind.cpp:1599-1600`、`1842` 暴露 `ClassDB.class_exists()`。

调用摘要：服务类注册 → 场景类与场景单例注册 → 物理/导航服务初始化 → 发布服务器单例 → 初始化脚本语言。ClassDB 注册类型与 Engine 发布服务实例是两个不同阶段。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [core_bind.cpp](src/upstream/core/core_bind.cpp) | [1599-1600](src/upstream/core/core_bind.cpp.excerpt) | engine/godot-4.7/core/core_bind.cpp |
| 2 | [main.cpp](src/upstream/main/main.cpp) | [1016-1032 ; 3033-3041 ; 3212-3229 ; 3776-3795 ; 3858-3867](src/upstream/main/main.cpp.excerpt) | engine/godot-4.7/main/main.cpp |
| 3 | [register_server_types.cpp](src/upstream/servers/register_server_types.cpp) | [146-170 ; 393-418](src/upstream/servers/register_server_types.cpp.excerpt) | engine/godot-4.7/servers/register_server_types.cpp |
| 4 | [rendering_server.cpp](src/upstream/servers/rendering/rendering_server.cpp) | [3511-3511](src/upstream/servers/rendering/rendering_server.cpp.excerpt) | engine/godot-4.7/servers/rendering/rendering_server.cpp |

## GDScript 源码复刻

S03 Godot 4.7: ClassDB registration precedes service singleton publication.

source_replay.gd 按本课指定快照复刻控制流与状态传递，模型中的状态字段、函数入口和 API 名称对应本代 C++ 路径。根目录实验脚本先运行模型，再调用对应版本的 Godot API。

| GDScript 函数 | 复刻步骤 |
| --- | --- |
| _register_class() | 将类型名、父类和创建资格写入类型表 |
| _publish() | 把服务器对象名称加入脚本可见单例表 |
| _stage() | 按实际初始化先后追加阶段 |

## 最小 Godot/GDScript 实验

- `project.godot`：Godot 4.7 项目配置，版本 5。
- `main.tscn`：format 3 文本场景。
- `server_probe.gd`：检查 `Node2D` / `RenderingServer` 类型，并读取渲染服务帧对象数。

从本目录运行：

```sh
godot
```

预期两项 `ClassDB.class_exists()` 都为真，随后输出 `RenderingServer` 的帧对象统计整数。计数值与渲染后端和当前帧有关；本实验只观察类型和服务 API 可用性。

## 简化与边界

本课只跟踪桌面项目的主要初始化顺序，省略各服务器后端创建细节、扩展初始化级别和禁用模块的编译分支。Godot 4 的 `RenderingServer`、`ClassDB` 和 `Engine` 注册方式不套用到旧版本。本课依据静态源码，未运行实验。

## 下一课

继续阅读 [s04_main_loop_creation](../s04_main_loop_creation/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
