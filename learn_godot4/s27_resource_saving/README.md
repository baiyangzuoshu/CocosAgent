# 第 27 课：ResourceSaver 选择保存器并持久化

**目标：** 基于 `godot-4.7`（4.7.3-rc）追踪本课 C++ 路径，并用一个独立 Godot/GDScript 项目观察公开行为。

## 本课问题

ResourceSaver 如何根据资源路径和类型选择 ResourceFormatSaver？保存返回值与重新加载能证明哪些内容已持久化？

## 本课增量

ResourceSaver::save 接收 Resource 和目标路径，遍历已注册 saver 写出资源；有 UID 的 saver 还可以更新资源 ID 映射。

## C++ 源码追踪

```text
ResourceSaver::save → registered ResourceFormatSaver → serialized file and optional UID update
```

从脚本层 ResourceSaver.save 进入 C++ ResourceSaver::save，检查资源合法性和文件扩展名，再调用匹配 saver 的 save。返回 Error 后可用 ResourceLoader.load 重新打开文件。

按 README 中表格顺序阅读完整源码副本。行号对应 `godot-4.7` 本地上游快照；每个 `.excerpt` 只保留本课所需的完整函数，其余上下文可在同目录完整源文件中查看。

## 本课源码复刻

`src/upstream/` 保留本课涉及的完整上游文件副本，按 Godot 原目录组织；文件逐字节来自 `engine/godot-4.7/`，不包含本课改写。函数摘录带原始行号，方便和完整文件互相核对。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 顺序 | 完整 C++ 源码 | 函数摘录 | 上游文件与行段 |
| --- | --- | --- | --- |
| 1 | [resource_saver.cpp](src/upstream/core/io/resource_saver.cpp) | [摘录](src/upstream/core/io/resource_saver.cpp.excerpt) | `engine/godot-4.7/core/io/resource_saver.cpp:102-155, 157-172` |

## 最小 Godot/GDScript 实验

创建 Resource，保存到 user://s27_saved_resource.tres，再读回并打印路径和资源名。

- 项目脚本：[`probe.gd`](probe.gd)
- 启动场景：[`main.tscn`](main.tscn)
- 资源夹具：[`payload.tscn`](payload.tscn)

## 运行与预期观察

在本课目录使用与项目格式匹配的 Godot 程序运行：

```sh
godot --path .
```

预期观察：save 返回 OK 后，重新加载得到 Resource；文件写入 user:// 项目数据目录，不改动课程目录。

本课只按源码静态追踪并整理预期结果；若未另外记录运行日志，不把预期观察写成已验证结果。

## 简化与边界

只保存一个通用 Resource 到 user://，不写项目源文件；未验证外部资源依赖、二进制格式 flags、UID 持久化或原子替换。

## 下一课

继续阅读 [s28_input_event_flow](../s28_input_event_flow/README.md)。
