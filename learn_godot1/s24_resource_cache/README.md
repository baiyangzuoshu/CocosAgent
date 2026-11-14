# 第 24 课：ResourceCache 的路径与共享引用

**目标：** 基于 `godot-1.1`（1.1 stable）追踪本课 C++ 路径，并用一个独立 Godot/GDScript 项目观察公开行为。

## 本课问题

本版本是否提供公开的后台资源加载接口？交互式 poll、阻塞 wait、内部线程重入跟踪和真正的线程加载请求有什么区别？

## 本课增量

S21–S23 建立 Resource 路径与加载路径；本课确认同一路径如何回到已缓存对象。

## C++ 源码追踪

```text
ResourceLoader::load(path) → ResourceCache::get(local_path) → reuse existing Resource
```

ResourceCache 按本代的规范化路径保存资源对象。再次 load 相同路径时，ResourceLoader 可返回缓存中的 Resource。

按 README 中表格顺序阅读完整源码副本。行号对应 `godot-1.1` 本地上游快照；每个 `.excerpt` 只保留本课所需的完整函数，其余上下文可在同目录完整源文件中查看。

## 本课源码复刻

`src/upstream/` 保留本课涉及的完整上游文件副本，按 Godot 原目录组织；文件逐字节来自 `engine/godot-1.1/`，不包含本课改写。函数摘录带原始行号，方便和完整文件互相核对。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 顺序 | 完整 C++ 源码 | 函数摘录 | 上游文件与行段 |
| --- | --- | --- | --- |
| 1 | [resource.cpp](src/upstream/core/resource.cpp) | [摘录](src/upstream/core/resource.cpp.excerpt) | `engine/godot-1.1/core/resource.cpp:368-378` |
| 2 | [resource_loader.cpp](src/upstream/core/io/resource_loader.cpp) | [摘录](src/upstream/core/io/resource_loader.cpp.excerpt) | `engine/godot-1.1/core/io/resource_loader.cpp:152-211` |

## 最小 Godot/GDScript 实验

加载 payload 两次，观察同一文件路径的缓存对象复用。Godot 1.1 的 S24 主题是缓存，不含后台加载实验。

- 项目脚本：[`probe.gd`](probe.gd)
- 启动场景：`main.xml`（Godot 1.1）
- 资源夹具：`payload.xml`（Godot 1.1）

## 运行与预期观察

在本课目录使用与项目格式匹配的 Godot 程序运行：

```sh
godot -path .
```

预期观察：加载 payload 两次并比较对象身份，观察缓存复用；Godot 1.1 的 S24 主题是资源缓存，不含线程 API。

本课只按源码静态追踪并整理预期结果；若未另外记录运行日志，不把预期观察写成已验证结果。

## 简化与边界

Godot 2.1/3.6 的结论严格限于本地快照公开 API；Godot 3 的内部线程重入追踪不等于线程化加载接口。Godot 4 的 worker 细节和完成时长受资源、平台与线程池影响。

## 下一课

继续阅读 [s25_packed_scene_instance](../s25_packed_scene_instance/README.md)。
