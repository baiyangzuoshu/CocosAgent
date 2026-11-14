# 第 22 课：ResourceLoader 格式分派

**目标：** 基于 `godot-4.7`（4.7.3-rc）追踪本课 C++ 路径，并用一个独立 Godot/GDScript 项目观察公开行为。

## 本课问题

ResourceLoader 如何从路径和 type hint 选中格式加载器？格式加载器由哪里注册，缓存和 path remap 在选择前还是选择后发生？

## 本课增量

资源格式不是由 GDScript 按扩展名手写分支决定。启动注册阶段把格式加载器加入 ResourceLoader，加载时再依据路径和 type hint 选择能够处理该请求的 loader。

## C++ 源码追踪

```text
ResourceLoader::_load → type/extension match → ResourceFormatLoader::load → Resource
```

register_core_types()/add_resource_format_loader → ResourceLoader.load → 遍历 loader → 类型/扩展名匹配 → loader.load。

按 README 中表格顺序阅读完整源码副本。行号对应 `godot-4.7` 本地上游快照；每个 `.excerpt` 只保留本课所需的完整函数，其余上下文可在同目录完整源文件中查看。

## 本课源码复刻

`src/upstream/` 保留本课涉及的完整上游文件副本，按 Godot 原目录组织；文件逐字节来自 `engine/godot-4.7/`，不包含本课改写。函数摘录带原始行号，方便和完整文件互相核对。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 顺序 | 完整 C++ 源码 | 函数摘录 | 上游文件与行段 |
| --- | --- | --- | --- |
| 1 | [resource_loader.cpp](src/upstream/core/io/resource_loader.cpp) | [摘录](src/upstream/core/io/resource_loader.cpp.excerpt) | `engine/godot-4.7/core/io/resource_loader.cpp:275-333, 1270-1283` |

## 最小 Godot/GDScript 实验

加载课内 payload 场景并观察得到的 Resource；对照 ResourceLoader.load 中缓存、路径 remap 与 loader 遍历的先后顺序。

- 项目脚本：[`probe.gd`](probe.gd)
- 启动场景：[`main.tscn`](main.tscn)
- 资源夹具：[`payload.tscn`](payload.tscn)

## 运行与预期观察

在本课目录使用与项目格式匹配的 Godot 程序运行：

```sh
godot --path .
```

预期观察：加载课内 payload 场景并观察得到的 Resource；对照 ResourceLoader.load 中缓存、路径 remap 与 loader 遍历的先后顺序。

本课只按源码静态追踪并整理预期结果；若未另外记录运行日志，不把预期观察写成已验证结果。

## 简化与边界

课程只覆盖 ResourceLoader 注册表与格式选择入口；具体文本/二进制解析、导入 remap、错误恢复和自定义 loader 另有分支。

## 下一课

继续阅读 [s23_resource_cache_uid](../s23_resource_cache_uid/README.md)。
