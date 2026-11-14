# 第 2 课：`Main::setup()` 初始化与参数流

**目标：** 以 Godot 4.7 的 `Main::setup()` 为主线，追踪核心初始化、项目路径解析、引擎参数与用户参数的分流，以及 `setup2()` 的阶段边界。

## 本课增量

加入 Godot 4 的 --path、引擎参数与 --/++ 用户参数分流，并保留缺少参数值的错误返回。

**本课要回答：** Godot 4 的 `Main::setup()` 负责哪些初始化？`--` 如何改变参数处理？为什么要区分 `OS.get_cmdline_args()` 和 `OS.get_cmdline_user_args()`？

## C++ 源码追踪

源码依据：`engine/godot-4.7/`（Godot 4.7 对应本地快照）。阅读顺序按真实调用关系排列；函数名、参数和分支以本课完整源码副本为准。

以下路径相对于 `engine/godot-4.7/` 快照根目录：

- `main/main.cpp:1016-1032`：源码注释把启动分为 `setup()`、`setup2()`、`start()` 三步；`setup()` 处理低层初始化和一部分命令行参数，`start()` 还会解析自己的参数子集。
- `main/main.cpp:1035-1068`、`1087-1098`：初始化 OS、核心类型及项目设置对象，然后创建 `args`、`main_args`、`user_args` 与分流状态。
- `main/main.cpp:1768-1785`：`--path` 只在定义 `OVERRIDE_PATH_ENABLED` 的构建中接受；未启用时会明确报错。因此本实验从项目目录启动，不依赖该构建选项。
- `main/main.cpp:2069-2073`：遇到 `--` 或 `++` 后，后续参数进入 `user_args`；此前未专门处理的参数进入 `main_args`。
- `main/main.cpp:2106-2108`、`2250`、`2933-2942`：设置 editor 状态、读取项目设置、通过 `OS::set_cmdline()` 保存两组参数，最后按 `p_second_phase` 选择是否调用 `setup2()`。
- `core/core_bind.cpp:518-535`、`809-810`：包装层分别复制引擎参数和用户参数，并绑定 `OS.get_cmdline_args()` 与 `OS.get_cmdline_user_args()`。

调用摘要：初始化核心 → 解析参数并按分隔符分组 → 读取项目设置并保存参数 → 可选 `setup2()` → 后续由 `start()` 创建运行入口。Godot 4 的分隔符之后参数应通过用户参数 API 读取。

## 本课源码复刻

完整上游文件按原路径复制到 src/upstream；摘录保留快照中的原始行段，每个完整文件都有 SHA-256 校验项。清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

| 阅读顺序 | 完整上游副本 | 原始行号摘录 | 上游快照路径 |
| --- | --- | --- | --- |
| 1 | [core_bind.cpp](src/upstream/core/core_bind.cpp) | [518-535](src/upstream/core/core_bind.cpp.excerpt) | engine/godot-4.7/core/core_bind.cpp |
| 2 | [main.cpp](src/upstream/main/main.cpp) | [1016-1032 ; 1035-1068 ; 1768-1785 ; 2069-2073 ; 2106-2108](src/upstream/main/main.cpp.excerpt) | engine/godot-4.7/main/main.cpp |

## GDScript 源码复刻

`src/source_replay.gd` 按本课列出的 C++ 入口重建关键数据结构、条件分支和状态更新。它是可逐步阅读的教学移植，不是完整引擎替身；模型函数表会标明直接对应的源码行为和仅用于组织输入/输出的脚手架。平台、线程、对象分配和服务器副作用仍由真实引擎处理。

| 模型函数 | C++ 源码对照或脚手架性质 | 复现的状态与分支 |
| --- | --- | --- |
| `_parse_args()` | `Main::setup args/main_args/user_args 分区` | 逐个扫描 argv，维护选项、项目路径和透传参数。 |
| `_setup()` | `Main::setup → ProjectSettings → OS::set_cmdline → setup2` | 将项目设置、剩余参数和第二阶段启动条件分开记录。 |

## 最小 Godot/GDScript 实验

- `project.godot`：Godot 4.7 项目入口，配置版本 5。
- `main.tscn`：format 3 文本场景。
- `args_probe.gd`：在 `_ready()` 分别打印引擎参数和用户参数。

从本目录运行：

```sh
godot -- --course-probe
```

预期 `OS.get_cmdline_user_args()` 包含 `--course-probe`。分隔符前的引擎选项由 `Main::setup()` 处理；本实验把自定义参数放在分隔符后，避免它进入引擎选项解析。

## 简化与边界

仅观察一条无值用户参数的路径，不处理脚本参数转义、平台注入参数或编辑器启动参数。项目路径使用当前目录默认值，规避源码中按构建选项控制的 `--path`。本文依据静态 Godot 4.7 源码，实验尚未运行。

## 下一课

继续阅读 [s03_engine_initialization](../s03_engine_initialization/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
