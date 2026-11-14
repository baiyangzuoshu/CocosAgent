# 第 26 课：场景外部资源依赖与读取顺序

**目标：** 基于 `godot-1.1`（1.1 stable）追踪本课 C++ 路径，并用一个独立 Godot/GDScript 项目观察公开行为。

## 本课问题

Godot 1.1 的 XML loader 如何枚举 ext_resource 依赖？poll/wait 推进解析时，外部 GDScript 何时被读取？

## 本课增量

XML loader 先收集场景中的外部资源路径，再在交互式读取阶段加载依赖并组合 PackedScene。课程夹具把 payload.gd 作为外部脚本引用。

## C++ 源码追踪

```text
ResourceInteractiveLoaderXML::get_dependencies → ext_resource paths → ResourceLoader → load stage sequence
```

先读 ResourceInteractiveLoaderXML::get_dependencies，确认扫描 ext_resource 的路径；再读 poll，追踪当前 stage 如何继续读取并装入依赖。GDScript 实验调用 load_interactive、wait 和 get_resource，只观察最终资源，不替代 XML parser。

按 README 中表格顺序阅读完整源码副本。行号对应 `godot-1.1` 本地上游快照；每个 `.excerpt` 只保留本课所需的完整函数，其余上下文可在同目录完整源文件中查看。

## 本课源码复刻

`src/upstream/` 保留本课涉及的完整上游文件副本，按 Godot 原目录组织；文件逐字节来自 `engine/godot-1.1/`，不包含本课改写。函数摘录带原始行号，方便和完整文件互相核对。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 顺序 | 完整 C++ 源码 | 函数摘录 | 上游文件与行段 |
| --- | --- | --- | --- |
| 1 | [resource_format_xml.cpp](src/upstream/core/io/resource_format_xml.cpp) | [摘录](src/upstream/core/io/resource_format_xml.cpp.excerpt) | `engine/godot-1.1/core/io/resource_format_xml.cpp:1362-1555, 1571-1623` |

## 最小 Godot/GDScript 实验

用 ResourceInteractiveLoader 加载 XML PackedScene，记录加载阶段和最终资源；对照 XML ext_resource 中的外部 GDScript 依赖。

- 项目脚本：[`probe.gd`](probe.gd)
- 启动场景：`main.xml`（Godot 1.1）
- 资源夹具：`payload.xml`（Godot 1.1）

## 运行与预期观察

在本课目录使用与项目格式匹配的 Godot 程序运行：

```sh
godot -path .
```

预期观察：loader 返回 PackedScene 后，XML 外部脚本依赖已被解析；stage 数依赖文件中的资源条目。

本课只按源码静态追踪并整理预期结果；若未另外记录运行日志，不把预期观察写成已验证结果。

## 简化与边界

只使用一个带外部 GDScript 的 XML 场景，观察依赖扫描与交互式加载；未覆盖多层资源依赖、循环引用、失败回滚和非脚本资源解析。

## 下一课

继续阅读 [s27_platform_input_event](../s27_platform_input_event/README.md)。
