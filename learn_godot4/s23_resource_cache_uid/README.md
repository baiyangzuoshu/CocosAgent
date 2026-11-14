# 第 23 课：ResourceCache、ResourceUID 与路径映射

**目标：** 基于 `godot-4.7`（4.7.3-rc）追踪本课 C++ 路径，并用一个独立 Godot/GDScript 项目观察公开行为。

## 本课问题

Godot 4 怎样在资源路径和 UID 之间查找、规范化？ResourceCache 的路径命中与 UID 路径映射各负责哪一步？

## 本课增量

Godot 4.7 用 ResourceUID 在资源 UID 与路径间映射；ResourceLoader 可查询资源 UID，ResourceCache 则仍按路径复用已加载对象。

## C++ 源码追踪

```text
ResourceCache::get_ref + ResourceLoader::get_resource_uid → ResourceUID path/ID mapping
```

先看 ResourceUID.path_to_uid/uid_to_path/ensure_path，再看 ResourceLoader.get_resource_uid 的 loader 查询，最后对照 ResourceCache::get_ref 的路径索引。

按 README 中表格顺序阅读完整源码副本。行号对应 `godot-4.7` 本地上游快照；每个 `.excerpt` 只保留本课所需的完整函数，其余上下文可在同目录完整源文件中查看。

## 本课源码复刻

`src/upstream/` 保留本课涉及的完整上游文件副本，按 Godot 原目录组织；文件逐字节来自 `engine/godot-4.7/`，不包含本课改写。函数摘录带原始行号，方便和完整文件互相核对。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 顺序 | 完整 C++ 源码 | 函数摘录 | 上游文件与行段 |
| --- | --- | --- | --- |
| 1 | [resource.cpp](src/upstream/core/io/resource.cpp) | [摘录](src/upstream/core/io/resource.cpp.excerpt) | `engine/godot-4.7/core/io/resource.cpp:852-871` |
| 2 | [resource_uid.cpp](src/upstream/core/io/resource_uid.cpp) | [摘录](src/upstream/core/io/resource_uid.cpp.excerpt) | `engine/godot-4.7/core/io/resource_uid.cpp:113-132, 162-174, 195-220, 243-250, 252-257` |
| 3 | [resource_loader.cpp](src/upstream/core/io/resource_loader.cpp) | [摘录](src/upstream/core/io/resource_loader.cpp.excerpt) | `engine/godot-4.7/core/io/resource_loader.cpp:1412-1426` |

## 最小 Godot/GDScript 实验

在运行时 UID 表中临时登记一个 user:// 探针路径，观察 path_to_uid/uid_to_path 往返映射后移除临时 ID；随后两次 load payload.tscn 比较资源缓存身份。

- 项目脚本：[`probe.gd`](probe.gd)
- 启动场景：[`main.tscn`](main.tscn)
- 资源夹具：[`payload.tscn`](payload.tscn)

## 运行与预期观察

在本课目录使用与项目格式匹配的 Godot 程序运行：

```sh
godot --path .
```

预期观察：临时登记后 path_to_uid 返回 UID 文本，uid_to_path 返回探针路径；移除临时 ID 后，同路径 load 仍可观察 ResourceCache 复用。

本课只按源码静态追踪并整理预期结果；若未另外记录运行日志，不把预期观察写成已验证结果。

## 简化与边界

UID 映射实验只在运行时登记并立即移除随机临时 ID；它不修改项目资源的 UID 文件。资源缓存观察限于同一进程、同一路径。

## 下一课

继续阅读 [s24_threaded_loading](../s24_threaded_loading/README.md)。
