# 第 26 课：PackedScene 的 pack、instance 与子场景

**目标：** 基于 `godot-2.1`（2.1.7-rc）追踪本课 C++ 路径，并用一个独立 Godot/GDScript 项目观察公开行为。

## 本课问题

PackedScene 保存 Node 树时复制哪些状态？instance/instantiate 结果与被 pack 的原始节点是什么关系？

## 本课增量

PackedScene::pack 从 Node 树提取可序列化节点状态；instance（Godot 1–3）或 instantiate（Godot 4）依据 PackedScene 数据创建新的节点树。实例不是原始 Node 的别名。

## C++ 源码追踪

```text
PackedScene::pack(root) → scene state → instance() → child PackedScene references instantiated
```

Node tree → PackedScene.pack(root) → scene state → instance()/instantiate() → 新 Node tree。

按 README 中表格顺序阅读完整源码副本。行号对应 `godot-2.1` 本地上游快照；每个 `.excerpt` 只保留本课所需的完整函数，其余上下文可在同目录完整源文件中查看。

## 本课源码复刻

`src/upstream/` 保留本课涉及的完整上游文件副本，按 Godot 原目录组织；文件逐字节来自 `engine/godot-2.1/`，不包含本课改写。函数摘录带原始行号，方便和完整文件互相核对。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 顺序 | 完整 C++ 源码 | 函数摘录 | 上游文件与行段 |
| --- | --- | --- | --- |
| 1 | [packed_scene.cpp](src/upstream/scene/resources/packed_scene.cpp) | [摘录](src/upstream/scene/resources/packed_scene.cpp.excerpt) | `engine/godot-2.1/scene/resources/packed_scene.cpp:1660-1663, 1675-1698` |

## 最小 Godot/GDScript 实验

脚本动态创建根节点和拥有的子节点，pack 后实例化，列出副本名称与子节点数量。

- 项目脚本：[`probe.gd`](probe.gd)
- 启动场景：[`main.tscn`](main.tscn)
- 资源夹具：[`payload.tscn`](payload.tscn)

## 运行与预期观察

在本课目录使用与项目格式匹配的 Godot 程序运行：

```sh
godot -path .
```

预期观察：脚本动态创建根节点和拥有的子节点，pack 后实例化，列出副本名称与子节点数量。

本课只按源码静态追踪并整理预期结果；若未另外记录运行日志，不把预期观察写成已验证结果。

## 简化与边界

示例只保存一个小 Node 树，省略 owner 过滤规则、脚本属性序列化细节、编辑器状态和资源引用优化。旧版方法名为 instance，Godot 4 改为 instantiate。

## 下一课

继续阅读 [s27_scene_serialization](../s27_scene_serialization/README.md)。
