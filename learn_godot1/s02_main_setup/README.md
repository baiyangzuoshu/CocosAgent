# 第 2 课：`Main::setup()` 参数解析与第一阶段初始化

**目标：** 追踪 Godot 1.1 如何从原始 `argv` 解析项目路径和启动选项，将剩余参数交给 OS 单例，再进入项目设置与第二阶段初始化。

## 本课增量

加入参数扫描状态机，复现旧版 -path/-editor 并把未知选项留在 OS 命令行参数；不假设存在 Godot 4 的 user_args 分区。

## 本课问题

`-path` 如何影响项目目录？未知参数会在哪里保存？`Main::setup()` 的哪些准备先于 `setup2()`？GDScript 能读取到哪一组参数？

## 源码调用链

源码依据：`engine/godot-1.1/`（Godot 1.1 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-1.1/` 快照根目录：

- `main/main.cpp:176-210`：`Main::setup()` 初始化 OS 核心和 `ObjectTypeDB`，注册核心类型与 Globals，再将 `argv` 转成待解析的字符串列表。
- `main/main.cpp:230`、`396-411`：默认项目目录是 `.`；`-path <目录>` 先尝试切换工作目录，失败时把该路径留作项目路径。
- `main/main.cpp:494-512`：未识别为引擎选项或项目路径的参数进入 `main_args`。
- `main/main.cpp:586-609`、`724-729`：读取项目设置后调用 `OS::set_cmdline(execpath, main_args)`；`p_second_phase` 为真时继续 `setup2()`。
- `core/bind/core_bind.cpp:352-358`、`774`：`_OS::get_cmdline_args()` 复制 OS 命令行列表，并通过 `ObjectTypeDB` 暴露给 GDScript。
- `main/main.cpp:880`：`Main::start()` 是后续启动阶段；本课不把它与 `setup()` 合并成一个步骤。

调用摘要：`argv` → `Main::setup()` 解析 → 项目设置 → `OS::set_cmdline()` 保存剩余参数 → 按入口参数选择是否调用 `setup2()`。Godot 1.1 通过 `OS.get_cmdline_args()` 暴露这一代的命令行列表。

## 本课源码复刻

`src/upstream/` 按 Godot 原目录保存本课涉及的完整上游源文件，文件内容直接来自 `godot-1.1` 快照；`.excerpt` 是带原始行号的重点行段，便于先定位再回看完整上下文。每课的副本清单和逐字节核对说明见 [`src/README.md`](src/README.md)。

| 阅读顺序 | 完整源码副本 | 摘录 | 上游版本路径 | 行段 |
| --- | --- | --- | --- | --- |
| 1 | [core_bind.cpp](src/upstream/core/bind/core_bind.cpp) | [摘录](src/upstream/core/bind/core_bind.cpp.excerpt) | `engine/godot-1.1/core/bind/core_bind.cpp` | 352-358 |
| 2 | [main.cpp](src/upstream/main/main.cpp) | [摘录](src/upstream/main/main.cpp.excerpt) | `engine/godot-1.1/main/main.cpp` | 176-210, 230-230 |

## GDScript 源码复刻与 C++ 对照

模型复现旧版 -path/-editor 参数扫描；未知项保留在传给 OS 的命令行列表中。这两代没有把 -- 后参数单独放入 Godot 4 的 user_args 列表。

src/upstream/ 保存本课引用的完整上游文件副本和带原始行号的摘录；src/source_replay.gd 执行表中的教学模型。先观察模型如何改变状态或走分支，再回到对应 C++ 函数核对。模型不替代 C++，也不代表引擎运行时本身。

| C++ 追踪阶段 | 模型函数 | 运行时要观察什么 |
| --- | --- | --- |
| Main::setup() 参数循环 | _parse_args() | 识别项目路径、引擎开关、-- 后脚本参数和缺值错误 |
| OS command line / 项目设置 | _main_setup() | 记录参数分流和 setup 状态 |
| setup / setup2 阶段边界 | _main_setup() | 保留初始化阶段及错误提前返回 |

独立项目入口先调用 source_replay.gd，再执行真实 Godot API 实验。实验脚本：args_probe.gd。模型输出是确定性的教学数据；只有实际用对应版本 Godot 运行后，才能记录为引擎实验验证。

## 最小 Godot/GDScript 实验

- `engine.cfg`：指定 Godot 1.1 主场景。
- `main.xml`：Godot 1.1 XML `PackedScene`，仅包含一个 Node。
- `args_probe.gd`：在 `_ready()` 中读取并逐项打印 `OS.get_cmdline_args()`。

在本目录运行：

```sh
godot -path . --course-probe
```

预期列表中包含 `--course-probe`。源码中它不匹配已知参数，因此在 `Main::setup()` 中进入 `main_args`；脚本只观察 OS 单例公开的结果，不模拟 C++ 参数解析。

## 简化与边界

实验只使用一个不带值的未知选项，避免把位置参数误作场景路径。`Main::start()` 还会解析它自己的选项子集；不同平台入口可能过滤或附加系统参数。本文依据静态的 Godot 1.1 快照，未运行此项目，也不据此断言本机 Godot 工具与快照构建一致。

## 下一课

继续阅读 [s03_main_setup2](../s03_main_setup2/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
