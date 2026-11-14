# 第 2 课：命令行、项目路径与 `Main::setup()`

**目标：** 追踪 Godot 2.1 的 `Main::setup()` 如何初始化核心类型、解析 `-path` 和其余参数、读取项目设置，并把剩余参数交给 OS 脚本接口。

## 本课问题

`-path` 在什么阶段处理？未知参数如何保留？项目设置读取和 `setup2()` 的调用次序是什么？脚本能观察到原始 `argv` 还是筛选后的参数？

## 源码调用链

源码依据：`engine/godot-2.1/`（Godot 2.1 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-2.1/` 快照根目录：

- `main/main.cpp:199-245`：`Main::setup()` 初始化 OS 核心、`ObjectTypeDB` 和 Globals，再把 `argv` 复制到待解析列表。
- `main/main.cpp:253`、`454-467`：项目路径默认是 `.`；`-path <目录>` 尝试切换工作目录，不能切换时则作为项目路径继续使用。
- `main/main.cpp:560-580`：未识别的参数进入 `main_args`，随后进入项目设置处理。
- `main/main.cpp:649-676`、`814-819`：调用 `globals->setup()` 读取项目；再以 `OS::set_cmdline(execpath, main_args)` 保存参数，并按 `p_second_phase` 选择是否继续 `setup2()`。
- `core/bind/core_bind.cpp:426-432`、`1101`：`_OS::get_cmdline_args()` 转为脚本可读的 `Vector<String>`，并通过 `ObjectTypeDB` 绑定。
- `main/main.cpp:1010`：`Main::start()` 会再次解析部分启动参数，因此 `setup()` 并非全部启动逻辑。

调用摘要：`argv` → `Main::setup()` 解析项目路径和选项 → `Globals::setup()` → 保存 `main_args` → 可选 `setup2()`。Godot 2.1 使用 `OS.get_cmdline_args()` 观察保存的参数。

## 本课源码复刻

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-2.1` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [core_bind.cpp](src/upstream/core/bind/core_bind.cpp) | [摘录](src/upstream/core/bind/core_bind.cpp.excerpt) | `engine/godot-2.1/core/bind/core_bind.cpp` | 426-432 |
| 2 | [main.cpp](src/upstream/main/main.cpp) | [摘录](src/upstream/main/main.cpp.excerpt) | `engine/godot-2.1/main/main.cpp` | 199-245 |

## 可运行源码复刻

课程代码 [`src/source_replay.gd`](src/source_replay.gd) 按本课 C++ 函数关系实现一个小型 GDScript 模型；入口脚本会先运行它，再执行下面的真实引擎 API 实验。阅读时把模型中的状态变化逐步映射到上方的 C++ 摘录。模型只复刻本课选出的路径，不声称等同于完整 Godot 引擎。

## 最小 Godot/GDScript 实验

- `engine.cfg`：指定主场景。
- `main.tscn`：Godot 2.1 format 1 文本场景，只包含一个 Node。
- `args_probe.gd`：在 `_ready()` 逐项打印 `OS.get_cmdline_args()`。

在本目录运行：

```sh
godot -path . --course-probe
```

预期输出列表包含 `--course-probe`。`Main::setup()` 将未识别参数放入 `main_args`，之后 `OS::set_cmdline()` 保存它们；实验观察的是该脚本接口，不等同于打印未经处理的原始 `argv`。

## 简化与边界

实验用单个未知选项隔离参数转交行为，不展开音视频驱动、远程调试、导出或编辑器参数。项目使用 Godot 2.1 的 `engine.cfg` 和 format 1 场景；本文仅完成静态源码与文件结构核对，未运行旧版工具。

## 下一课

继续阅读 [s03_engine_server_init](../s03_engine_server_init/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
