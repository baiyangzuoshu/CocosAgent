# 第 25 课：ResourceCache 路径映射与共享资源

**目标：** 基于 `godot-3.6`（3.6.4-rc）追踪本课 C++ 路径，并用一个独立 Godot/GDScript 项目观察公开行为。

## 本课问题

同一路径的第二次 load 是否复用 Resource？cache path 与资源对象的引用寿命如何分开观察？

## 本课增量

ResourceCache 以规范化资源路径映射 Resource。默认 load 再次命中该路径时复用缓存对象；cache mode / no_cache 参数会改变复用规则。

## C++ 源码追踪

```text
ResourceLoader::load → ResourceCache lookup → cache reuse unless no_cache → Resource::set_path
```

ResourceLoader.load(path) → remap/local path → ResourceCache 查询 → cache hit 返回已有对象；miss 时选 loader 并登记结果。

按 README 中表格顺序阅读完整源码副本。行号对应 `godot-3.6` 本地上游快照；每个 `.excerpt` 只保留本课所需的完整函数，其余上下文可在同目录完整源文件中查看。

## 本课源码复刻

`src/upstream/` 保留本课涉及的完整上游文件副本，按 Godot 原目录组织；文件逐字节来自 `engine/godot-3.6/`，不包含本课改写。函数摘录带原始行号，方便和完整文件互相核对。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 顺序 | 完整 C++ 源码 | 函数摘录 | 上游文件与行段 |
| --- | --- | --- | --- |
| 1 | [resource.cpp](src/upstream/core/resource.cpp) | [摘录](src/upstream/core/resource.cpp.excerpt) | `engine/godot-3.6/core/resource.cpp:440-452` |
| 2 | [resource_loader.cpp](src/upstream/core/io/resource_loader.cpp) | [摘录](src/upstream/core/io/resource_loader.cpp.excerpt) | `engine/godot-3.6/core/io/resource_loader.cpp:338-424` |

## 最小 Godot/GDScript 实验

同一路径连续 load 两次并比较对象身份；再读取 get_path/resource_path，确认缓存键是资源路径。

- 项目脚本：[`probe.gd`](probe.gd)
- 启动场景：[`main.tscn`](main.tscn)
- 资源夹具：[`payload.tscn`](payload.tscn)

## 运行与预期观察

在本课目录使用与项目格式匹配的 Godot 程序运行：

```sh
godot --path .
```

预期观察：同一路径连续 load 两次并比较对象身份；再读取 get_path/resource_path，确认缓存键是资源路径。

本课只按源码静态追踪并整理预期结果；若未另外记录运行日志，不把预期观察写成已验证结果。

## 简化与边界

只比较同一运行时进程中的相同路径。Godot 4 cache mode 与旧版 no_cache 开关语义不同，不能跨代套用参数。

## 下一课

继续阅读 [s26_packed_scene_instance](../s26_packed_scene_instance/README.md)。
