# 第 21 课：Resource 路径与 Reference 生命周期

**目标：** 基于 `godot-1.1`（1.1 stable）追踪本课 C++ 路径，并用一个独立 Godot/GDScript 项目观察公开行为。

## 本课问题

资源路径何时进入 ResourceCache？Resource 与 Reference/RefCounted 的对象寿命如何相连？同一资源被两个脚本变量引用时，两个变量是否指向同一个对象？

## 本课增量

Resource 路径由资源对象写入并维护缓存映射，旧版 Resource 继承 Reference，新版 Resource 继承 RefCounted。脚本只观察已加载资源的路径和同一路径的对象复用，不直接改引擎引用计数。

## C++ 源码追踪

```text
load(path) → Resource::set_path → ResourceCache::resources[path] → Reference::unreference
```

ResourceLoader.load(path) → format loader 创建 Resource → Resource.set_path(path) → ResourceCache 登记 → 引用归零时由 Reference/RefCounted 释放。

按 README 中表格顺序阅读完整源码副本。行号对应 `godot-1.1` 本地上游快照；每个 `.excerpt` 只保留本课所需的完整函数，其余上下文可在同目录完整源文件中查看。

## 本课源码复刻

`src/upstream/` 保留本课涉及的完整上游文件副本，按 Godot 原目录组织；文件逐字节来自 `engine/godot-1.1/`，不包含本课改写。函数摘录带原始行号，方便和完整文件互相核对。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 顺序 | 完整 C++ 源码 | 函数摘录 | 上游文件与行段 |
| --- | --- | --- | --- |
| 1 | [resource.cpp](src/upstream/core/resource.cpp) | [摘录](src/upstream/core/resource.cpp.excerpt) | `engine/godot-1.1/core/resource.cpp:160-191` |
| 2 | [reference.cpp](src/upstream/core/reference.cpp) | [摘录](src/upstream/core/reference.cpp.excerpt) | `engine/godot-1.1/core/reference.cpp:66-74` |

## 最小 Godot/GDScript 实验

把同一路径加载两次，记录路径与对象相等性；再丢弃一个 GDScript 引用，另一个引用仍可访问该资源。

- 项目脚本：[`probe.gd`](probe.gd)
- 启动场景：`main.xml`（Godot 1.1）
- 资源夹具：`payload.xml`（Godot 1.1）

## 运行与预期观察

在本课目录使用与项目格式匹配的 Godot 程序运行：

```sh
godot -path .
```

预期观察：把同一路径加载两次，记录路径与对象相等性；再丢弃一个 GDScript 引用，另一个引用仍可访问该资源。

本课只按源码静态追踪并整理预期结果；若未另外记录运行日志，不把预期观察写成已验证结果。

## 简化与边界

脚本比较对象身份和持有引用，不读取引擎内部 refcount 数值，也不证明多个平台在文件系统层面返回完全相同的资源。

## 下一课

继续阅读 [s22_resource_loader](../s22_resource_loader/README.md)。
