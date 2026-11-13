# 第 2 课：`Main::setup()` 参数解析与第一阶段初始化

**目标：** 追踪 Godot 1.1 如何从原始 `argv` 解析项目路径和启动选项，将剩余参数交给 OS 单例，再进入项目设置与第二阶段初始化。

## 本课问题

`-path` 如何影响项目目录？未知参数会在哪里保存？`Main::setup()` 的哪些准备先于 `setup2()`？GDScript 能读取到哪一组参数？

## C++ 源码追踪

以下路径相对于 `engine/godot-1.1/` 快照根目录：

- `main/main.cpp:176-210`：`Main::setup()` 初始化 OS 核心和 `ObjectTypeDB`，注册核心类型与 Globals，再将 `argv` 转成待解析的字符串列表。
- `main/main.cpp:230`、`396-411`：默认项目目录是 `.`；`-path <目录>` 先尝试切换工作目录，失败时把该路径留作项目路径。
- `main/main.cpp:494-512`：未识别为引擎选项或项目路径的参数进入 `main_args`。
- `main/main.cpp:586-609`、`724-729`：读取项目设置后调用 `OS::set_cmdline(execpath, main_args)`；`p_second_phase` 为真时继续 `setup2()`。
- `core/bind/core_bind.cpp:352-358`、`774`：`_OS::get_cmdline_args()` 复制 OS 命令行列表，并通过 `ObjectTypeDB` 暴露给 GDScript。
- `main/main.cpp:880`：`Main::start()` 是后续启动阶段；本课不把它与 `setup()` 合并成一个步骤。

调用摘要：`argv` → `Main::setup()` 解析 → 项目设置 → `OS::set_cmdline()` 保存剩余参数 → 按入口参数选择是否调用 `setup2()`。Godot 1.1 通过 `OS.get_cmdline_args()` 暴露这一代的命令行列表。

## 最小实验

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
