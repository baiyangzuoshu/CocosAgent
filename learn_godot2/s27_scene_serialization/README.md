# 第 27 课：文本场景中的外部资源依赖

**目标：** 基于 `godot-2.1`（2.1.7-rc）追踪本课 C++ 路径，并用一个独立 Godot/GDScript 项目观察公开行为。

## 本课问题

文本场景如何通过 ExtResource 引入外部文件？外部路径如何变成场景节点属性或继承节点？

## 本课增量

文本场景中的 ExtResource 将本地 ID 映射到外部资源路径和类型。读取节点属性时解析器沿这个映射调用 ResourceLoader；场景继承则把一个 PackedScene 作为基础，再应用本地覆盖。

## C++ 源码追踪

```text
ResourceInteractiveLoaderText::poll → parse [ext_resource] → ResourceLoader::load(path,type) → property resolves
```

parse [ext_resource] / instance → local ID → path/type → ResourceLoader.load → property/node composition。

按 README 中表格顺序阅读完整源码副本。行号对应 `godot-2.1` 本地上游快照；每个 `.excerpt` 只保留本课所需的完整函数，其余上下文可在同目录完整源文件中查看。

## 本课源码复刻

`src/upstream/` 保留本课涉及的完整上游文件副本，按 Godot 原目录组织；文件逐字节来自 `engine/godot-2.1/`，不包含本课改写。函数摘录带原始行号，方便和完整文件互相核对。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 顺序 | 完整 C++ 源码 | 函数摘录 | 上游文件与行段 |
| --- | --- | --- | --- |
| 1 | [scene_format_text.cpp](src/upstream/scene/resources/scene_format_text.cpp) | [摘录](src/upstream/scene/resources/scene_format_text.cpp.excerpt) | `engine/godot-2.1/scene/resources/scene_format_text.cpp:90-134, 184-648` |

## 最小 Godot/GDScript 实验

main.tscn 显式实例化 payload.tscn。加载主场景后枚举外部实例节点，跟踪 ext_resource ID 到文件路径的映射。

- 项目脚本：[`probe.gd`](probe.gd)
- 启动场景：[`main.tscn`](main.tscn)
- 资源夹具：[`payload.tscn`](payload.tscn)

## 运行与预期观察

在本课目录使用与项目格式匹配的 Godot 程序运行：

```sh
godot -path .
```

预期观察：加载课内 payload 场景；Godot 3/4 同时运行继承场景并检查基类带入的子节点。Godot 4 本课改为 ResourceSaver 保存并重新加载一个 Resource。

本课只按源码静态追踪并整理预期结果；若未另外记录运行日志，不把预期观察写成已验证结果。

## 简化与边界

Godot 4 S27 专讲 ResourceSaver；其余代际本课追踪场景文件的外部依赖。各代资源格式不同，不能互换。

## 下一课

继续阅读 [s28_input_event_creation](../s28_input_event_creation/README.md)。
