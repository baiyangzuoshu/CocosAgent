# 第 2 课：`Main::setup()` 初始化与参数流

**目标：** 以 Godot 4.7 的 `Main::setup()` 为主线，追踪核心初始化、项目路径解析、引擎参数与用户参数的分流，以及 `setup2()` 的阶段边界。

## 本课问题

Godot 4 的 `Main::setup()` 负责哪些初始化？`--` 如何改变参数处理？为什么要区分 `OS.get_cmdline_args()` 和 `OS.get_cmdline_user_args()`？

## C++ 源码追踪

以下路径相对于 `engine/godot-4.7/` 快照根目录：

- `main/main.cpp:1016-1032`：源码注释把启动分为 `setup()`、`setup2()`、`start()` 三步；`setup()` 处理低层初始化和一部分命令行参数，`start()` 还会解析自己的参数子集。
- `main/main.cpp:1035-1068`、`1087-1098`：初始化 OS、核心类型及项目设置对象，然后创建 `args`、`main_args`、`user_args` 与分流状态。
- `main/main.cpp:1768-1785`：`--path` 只在定义 `OVERRIDE_PATH_ENABLED` 的构建中接受；未启用时会明确报错。因此本实验从项目目录启动，不依赖该构建选项。
- `main/main.cpp:2069-2073`：遇到 `--` 或 `++` 后，后续参数进入 `user_args`；此前未专门处理的参数进入 `main_args`。
- `main/main.cpp:2106-2108`、`2250`、`2933-2942`：设置 editor 状态、读取项目设置、通过 `OS::set_cmdline()` 保存两组参数，最后按 `p_second_phase` 选择是否调用 `setup2()`。
- `core/core_bind.cpp:518-535`、`809-810`：包装层分别复制引擎参数和用户参数，并绑定 `OS.get_cmdline_args()` 与 `OS.get_cmdline_user_args()`。

调用摘要：初始化核心 → 解析参数并按分隔符分组 → 读取项目设置并保存参数 → 可选 `setup2()` → 后续由 `start()` 创建运行入口。Godot 4 的分隔符之后参数应通过用户参数 API 读取。

## 最小实验

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

## 本课 C++ 源码摘录

课内摘录保留对应 Godot 源码行段正文，并在段首标出原始行号；完整上下文以只读的 engine 快照为准。摘录用于追踪，不是独立编译单元。许可文本见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 课内摘录 | Godot 源文件 | 上游行段 |
| --- | --- | --- |
| [core_bind.cpp](src/upstream/core/core_bind.cpp.excerpt) | godot-4.7/core/core_bind.cpp | 518-535 |
| [main.cpp](src/upstream/main/main.cpp.excerpt) | godot-4.7/main/main.cpp | 1016-1032, 1035-1068, 1768-1785, 2069-2073, 2106-2108 |
