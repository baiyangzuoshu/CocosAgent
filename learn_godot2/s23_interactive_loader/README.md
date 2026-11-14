# 第 23 课：ResourceInteractiveLoader 的分阶段加载

**目标：** 基于 `godot-2.1`（2.1.7-rc）追踪本课 C++ 路径，并用一个独立 Godot/GDScript 项目观察公开行为。

## 本课问题

load_interactive 返回的对象如何推进加载？poll、wait、stage 和 get_resource 分别在什么时点生效？

## 本课增量

交互式加载先取得 ResourceInteractiveLoader；每次 poll 推进一个或多个 format stage，达到 EOF 后 get_resource 才拿到完整资源。wait 则循环等待到结束。

## C++ 源码追踪

```text
load_interactive → ResourceFormatLoader::load_interactive → poll stages → get_resource at EOF
```

ResourceLoader.load_interactive → ResourceFormatLoader.load_interactive → ResourceInteractiveLoader.poll → ERR_FILE_EOF → get_resource。

按 README 中表格顺序阅读完整源码副本。行号对应 `godot-2.1` 本地上游快照；每个 `.excerpt` 只保留本课所需的完整函数，其余上下文可在同目录完整源文件中查看。

## 本课源码复刻

`src/upstream/` 保留本课涉及的完整上游文件副本，按 Godot 原目录组织；文件逐字节来自 `engine/godot-2.1/`，不包含本课改写。函数摘录带原始行号，方便和完整文件互相核对。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 顺序 | 完整 C++ 源码 | 函数摘录 | 上游文件与行段 |
| --- | --- | --- | --- |
| 1 | [resource_loader.cpp](src/upstream/core/io/resource_loader.cpp) | [摘录](src/upstream/core/io/resource_loader.cpp.excerpt) | `engine/godot-2.1/core/io/resource_loader.cpp:41-49, 284-341` |
| 2 | [core_bind.cpp](src/upstream/core/bind/core_bind.cpp) | [摘录](src/upstream/core/bind/core_bind.cpp.excerpt) | `engine/godot-2.1/core/bind/core_bind.cpp:66-68` |

## 最小 Godot/GDScript 实验

在 _process 中每帧调用一次 poll，打印 stage/stage_count；EOF 时取回 PackedScene 并停止处理。

- 项目脚本：[`probe.gd`](probe.gd)
- 启动场景：[`main.tscn`](main.tscn)
- 资源夹具：[`payload.tscn`](payload.tscn)

## 运行与预期观察

在本课目录使用与项目格式匹配的 Godot 程序运行：

```sh
godot -path .
```

预期观察：在 _process 中每帧调用一次 poll，打印 stage/stage_count；EOF 时取回 PackedScene 并停止处理。

本课只按源码静态追踪并整理预期结果；若未另外记录运行日志，不把预期观察写成已验证结果。

## 简化与边界

poll 的 stage 数由资源格式和依赖决定。EOF 表示本 loader 完成；它不等同于每帧都只执行固定毫秒数的异步工作。

## 下一课

继续阅读 [s24_incremental_loading_boundary](../s24_incremental_loading_boundary/README.md)。
