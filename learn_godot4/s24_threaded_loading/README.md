# 第 24 课：线程化请求、状态轮询与结果交付

**目标：** 基于 `godot-4.7`（4.7.3-rc）追踪本课 C++ 路径，并用一个独立 Godot/GDScript 项目观察公开行为。

## 本课问题

本版本是否提供公开的后台资源加载接口？交互式 poll、阻塞 wait、内部线程重入跟踪和真正的线程加载请求有什么区别？

## 本课增量

Godot 4.7 提供公开线程加载请求；worker 执行加载，GDScript 轮询状态与进度，完成后取回 Resource。

## C++ 源码追踪

```text
load_threaded_request → worker task → load_threaded_get_status(progress) → load_threaded_get
```

请求成功后，status 可能先为 THREAD_LOAD_IN_PROGRESS；主线程每帧轮询进度。只有 THREAD_LOAD_LOADED 才取回结果；失败或无效路径必须单独处理。

按 README 中表格顺序阅读完整源码副本。行号对应 `godot-4.7` 本地上游快照；每个 `.excerpt` 只保留本课所需的完整函数，其余上下文可在同目录完整源文件中查看。

## 本课源码复刻

`src/upstream/` 保留本课涉及的完整上游文件副本，按 Godot 原目录组织；文件逐字节来自 `engine/godot-4.7/`，不包含本课改写。函数摘录带原始行号，方便和完整文件互相核对。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 顺序 | 完整 C++ 源码 | 函数摘录 | 上游文件与行段 |
| --- | --- | --- | --- |
| 1 | [resource_loader.cpp](src/upstream/core/io/resource_loader.cpp) | [摘录](src/upstream/core/io/resource_loader.cpp.excerpt) | `engine/godot-4.7/core/io/resource_loader.cpp:700-703, 887-930, 932-1001` |
| 2 | [core_bind.cpp](src/upstream/core/core_bind.cpp) | [摘录](src/upstream/core/core_bind.cpp.excerpt) | `engine/godot-4.7/core/core_bind.cpp:145-172` |

## 最小 Godot/GDScript 实验

request 后每帧查询 status 与 progress；只在 THREAD_LOAD_LOADED 后调用 load_threaded_get。

- 项目脚本：[`probe.gd`](probe.gd)
- 启动场景：[`main.tscn`](main.tscn)
- 资源夹具：[`payload.tscn`](payload.tscn)

## 运行与预期观察

在本课目录使用与项目格式匹配的 Godot 程序运行：

```sh
godot --path .
```

预期观察：状态先保持加载中，完成后转为 THREAD_LOAD_LOADED，脚本取回 PackedScene；实际帧数与进度由平台和资源决定。

本课只按源码静态追踪并整理预期结果；若未另外记录运行日志，不把预期观察写成已验证结果。

## 简化与边界

Godot 2.1/3.6 的结论严格限于本地快照公开 API；Godot 3 的内部线程重入追踪不等于线程化加载接口。Godot 4 的 worker 细节和完成时长受资源、平台与线程池影响。

## 下一课

继续阅读 [s25_packed_scene_instantiation](../s25_packed_scene_instantiation/README.md)。
