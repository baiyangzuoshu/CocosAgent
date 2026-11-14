# 第 24 课：ResourceLoader 线程重入跟踪与 API 边界

**目标：** 基于 `godot-3.6`（3.6.4-rc）追踪本课 C++ 路径，并用一个独立 Godot/GDScript 项目观察公开行为。

## 本课问题

本版本是否提供公开的后台资源加载接口？交互式 poll、阻塞 wait、内部线程重入跟踪和真正的线程加载请求有什么区别？

## 本课增量

Godot 3.6 的 ResourceLoader 记录路径与调用线程以避免循环依赖；公开脚本 API 仍是 load/load_interactive。

## C++ 源码追踪

```text
load_interactive registers (path, Thread::get_caller_id) → loading map blocks cyclic same-thread recursion; no public load_threaded_request
```

loading_map 的 key 同时含资源路径与 Thread::get_caller_id()。它是递归/重入保护，不是用户可轮询的 worker load task。

按 README 中表格顺序阅读完整源码副本。行号对应 `godot-3.6` 本地上游快照；每个 `.excerpt` 只保留本课所需的完整函数，其余上下文可在同目录完整源文件中查看。

## 本课源码复刻

`src/upstream/` 保留本课涉及的完整上游文件副本，按 Godot 原目录组织；文件逐字节来自 `engine/godot-3.6/`，不包含本课改写。函数摘录带原始行号，方便和完整文件互相核对。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 顺序 | 完整 C++ 源码 | 函数摘录 | 上游文件与行段 |
| --- | --- | --- | --- |
| 1 | [resource_loader.cpp](src/upstream/core/io/resource_loader.cpp) | [摘录](src/upstream/core/io/resource_loader.cpp.excerpt) | `engine/godot-3.6/core/io/resource_loader.cpp:294-312, 326-336, 455-524` |

## 最小 Godot/GDScript 实验

先观察 S23 的逐帧 poll；本课将同一 loader 交给 wait()，记录返回状态与耗时。wait() 会在当前调用中持续推进，不能当作后台线程请求。

- 项目脚本：[`probe.gd`](probe.gd)
- 启动场景：[`main.tscn`](main.tscn)
- 资源夹具：[`payload.tscn`](payload.tscn)

## 运行与预期观察

在本课目录使用与项目格式匹配的 Godot 程序运行：

```sh
godot --path .
```

预期观察：wait 在当前调用中推进 loader 并返回完成状态；ResourceLoader 没有 Godot 4 风格的 threaded request/status/get。

本课只按源码静态追踪并整理预期结果；若未另外记录运行日志，不把预期观察写成已验证结果。

## 简化与边界

Godot 2.1/3.6 的结论严格限于本地快照公开 API；Godot 3 的内部线程重入追踪不等于线程化加载接口。Godot 4 的 worker 细节和完成时长受资源、平台与线程池影响。

## 下一课

继续阅读 [s25_resource_cache](../s25_resource_cache/README.md)。
