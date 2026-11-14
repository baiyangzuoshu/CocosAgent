# 第 24 课：分帧读取与阻塞 wait 的边界

**目标：** 基于 `godot-2.1`（2.1.7-rc）追踪本课 C++ 路径，并用一个独立 Godot/GDScript 项目观察公开行为。

## 本课问题

本版本是否提供公开的后台资源加载接口？交互式 poll、阻塞 wait、内部线程重入跟踪和真正的线程加载请求有什么区别？

## 本课增量

Godot 2.1 提供交互式 poll/wait；它没有 Godot 4 的 load_threaded_request/status/get 脚本接口。

## C++ 源码追踪

```text
load_interactive → poll once per frame; wait() repeatedly polls until completion and blocks caller
```

wait() 在当前调用中重复推进 ResourceInteractiveLoader，直到 EOF 或错误返回。分帧 poll 可让游戏主循环继续运行；wait 不会把工作移到后台线程。

按 README 中表格顺序阅读完整源码副本。行号对应 `godot-2.1` 本地上游快照；每个 `.excerpt` 只保留本课所需的完整函数，其余上下文可在同目录完整源文件中查看。

## 本课源码复刻

`src/upstream/` 保留本课涉及的完整上游文件副本，按 Godot 原目录组织；文件逐字节来自 `engine/godot-2.1/`，不包含本课改写。函数摘录带原始行号，方便和完整文件互相核对。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 顺序 | 完整 C++ 源码 | 函数摘录 | 上游文件与行段 |
| --- | --- | --- | --- |
| 1 | [resource_loader.cpp](src/upstream/core/io/resource_loader.cpp) | [摘录](src/upstream/core/io/resource_loader.cpp.excerpt) | `engine/godot-2.1/core/io/resource_loader.cpp:41-49, 151-213` |

## 最小 Godot/GDScript 实验

先观察 S23 的逐帧 poll；本课将同一 loader 交给 wait()，记录返回状态与耗时。wait() 会在当前调用中持续推进，不能当作后台线程请求。

- 项目脚本：[`probe.gd`](probe.gd)
- 启动场景：[`main.tscn`](main.tscn)
- 资源夹具：[`payload.tscn`](payload.tscn)

## 运行与预期观察

在本课目录使用与项目格式匹配的 Godot 程序运行：

```sh
godot -path .
```

预期观察：wait 返回 EOF 或错误状态后可读取完整资源；该调用期间不会继续执行本帧后续 GDScript。

本课只按源码静态追踪并整理预期结果；若未另外记录运行日志，不把预期观察写成已验证结果。

## 简化与边界

Godot 2.1/3.6 的结论严格限于本地快照公开 API；Godot 3 的内部线程重入追踪不等于线程化加载接口。Godot 4 的 worker 细节和完成时长受资源、平台与线程池影响。

## 下一课

继续阅读 [s25_resource_cache](../s25_resource_cache/README.md)。
