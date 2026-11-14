# 第 2 课：`Main::setup()` 参数解析与第一阶段初始化

**目标：** 追踪 Godot 1.1 如何从原始 `argv` 解析项目路径和启动选项，将剩余参数交给 OS 单例，再进入项目设置与第二阶段初始化。

## 本课增量

加入参数扫描状态机，复现旧版 -path/-editor 并把未知选项留在 OS 命令行参数；不假设存在 Godot 4 的 user_args 分区。

**本课要回答：** `-path` 如何影响项目目录？未知参数会在哪里保存？`Main::setup()` 的哪些准备先于 `setup2()`？GDScript 能读取到哪一组参数？

## C++ 源码追踪

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

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [core_bind.cpp](src/upstream/core/bind/core_bind.cpp) | [352-358](src/upstream/core/bind/core_bind.cpp.excerpt) | engine/godot-1.1/core/bind/core_bind.cpp |
| 2 | [main.cpp](src/upstream/main/main.cpp) | [176-210 ; 230-230 ; 494-512 ; 586-609 ; 880-880](src/upstream/main/main.cpp.excerpt) | engine/godot-1.1/main/main.cpp |

## GDScript 源码复刻

S02 Godot 1.1: legacy switches and unknown argv saved as OS main args.

source_replay.gd 按本课指定快照复刻控制流与状态传递，模型中的状态字段、函数入口和 API 名称对应本代 C++ 路径。根目录实验脚本先运行模型，再调用对应版本的 Godot API。

| GDScript 函数 | 复刻步骤 |
| --- | --- |
| _parse_args() | 逐项解析本代参数、分流或拒绝缺值选项 |
| _main_setup() | 执行核心/项目初始化并让错误状态提前返回 |

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
