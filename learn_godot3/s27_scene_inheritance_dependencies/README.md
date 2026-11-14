# 第 27 课：场景继承、实例覆盖与外部依赖

**目标：** 基于 `godot-3.6`（3.6.4-rc）追踪本课 C++ 路径，并用一个独立 Godot/GDScript 项目观察公开行为。

## 本课问题

文本场景如何解析外部资源 ID 和基础 PackedScene？派生场景的本地节点/脚本覆盖在哪一步叠加？

## 本课增量

场景解析器先建立 ext_resource ID 到 Resource 的映射；实例根节点加载基础 PackedScene 后，再解析派生文件的本地属性与节点覆盖。

## C++ 源码追踪

```text
ResourceInteractiveLoaderText::_parse_ext_resource / _parse_node_tag → dependencies and instance overrides
```

先读 ext_resource 解析函数，确认本地 ID 如何解析成路径并调用 ResourceLoader；再读 node tag/instance 解析，跟踪基础场景实例如何带入子节点，以及派生文件如何写入覆盖。Godot 3 使用 ResourceInteractiveLoaderText，Godot 4 使用 ResourceLoaderText。

按 README 中表格顺序阅读完整源码副本。行号对应 `godot-3.6` 本地上游快照；每个 `.excerpt` 只保留本课所需的完整函数，其余上下文可在同目录完整源文件中查看。

## 本课源码复刻

`src/upstream/` 保留本课涉及的完整上游文件副本，按 Godot 原目录组织；文件逐字节来自 `engine/godot-3.6/`，不包含本课改写。函数摘录带原始行号，方便和完整文件互相核对。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 顺序 | 完整 C++ 源码 | 函数摘录 | 上游文件与行段 |
| --- | --- | --- | --- |
| 1 | [resource_format_text.cpp](src/upstream/scene/resources/resource_format_text.cpp) | [摘录](src/upstream/scene/resources/resource_format_text.cpp.excerpt) | `engine/godot-3.6/scene/resources/resource_format_text.cpp:130-170, 172-364` |

## 最小 Godot/GDScript 实验

打开主场景：它继承 base_scene.tscn，基类的 BaseChild 会出现在实例树中。对照 .tscn 的 PackedScene 外部引用与脚本属性覆盖。

- 项目脚本：[`probe.gd`](probe.gd)
- 启动场景：[`main.tscn`](main.tscn)
- 资源夹具：[`payload.tscn`](payload.tscn)
- 基础场景：[`base_scene.tscn`](base_scene.tscn)

## 运行与预期观察

在本课目录使用与项目格式匹配的 Godot 程序运行：

```sh
godot --path .
```

预期观察：主场景根节点进入 _ready 时可枚举继承的 BaseChild；完整实例覆盖顺序以场景解析器源码为准。

本课只按源码静态追踪并整理预期结果；若未另外记录运行日志，不把预期观察写成已验证结果。

## 简化与边界

只用一个基础场景和一个派生场景观察 ext_resource/instance 解析与节点继承；不覆盖多层继承、editable children、节点重命名和编辑器场景合并策略。

## 下一课

继续阅读 [s28_input_event_flow](../s28_input_event_flow/README.md)。
