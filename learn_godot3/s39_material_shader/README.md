# 第 39 课：Mesh、Material、Shader 与渲染状态

**源码版本：** `godot-3.6`（3.6.4-rc）。本课按对应快照追踪 C++，再用独立 Godot/GDScript 工程对照可观察行为。

## 本课问题

Material 参数如何变成服务器状态或 shader 更新？资源 RID 与实际绘制状态如何关联？

## 本课增量

追踪 Material 的参数变更、shader dirty/update 和 RID 同步，不把资源属性等同于 GPU 状态。

## C++ 源码追踪

```text
Material3D::_update_shader / set_albedo → ShaderMaterial parameter → VisualServer material RID
```

从左到右逐层记录参数在哪一层转换、状态在哪一层更新、何处调用下一层。链尾结论只依据本课列出的版本源码，不跨版本外推。

- `scene/resources/material.cpp:362-1117` **`Material3D::_update_shader`**：依据 BaseMaterial 参数选择/重建 shader 变体。
- `scene/resources/material.cpp:1150-1154` **`Material3D::set_albedo`**：更改材质颜色并使相关 shader 参数或状态失效。
- `scene/resources/material.cpp:210-212` **`ShaderMaterial::set_shader_param`**：更新 ShaderMaterial 的参数映射并同步到服务器资源。

## 本课源码复刻

`src/upstream/` 按引擎原目录保存本课涉及的完整上游文件副本；`.excerpt` 保留所列原始行号函数摘录。副本逐字节对应 `engine/godot-3.6/`，SHA-256 清单可核验。优先从摘录读关键分支，再打开完整文件检查调用方和成员状态。许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。

| 阅读顺序 | 完整上游源码 | 函数摘录 | 快照行号 |
| --- | --- | --- | --- |
| 1 | [material.cpp](src/upstream/scene/resources/material.cpp) | [摘录 210-212, 362-1117, 1150-1154](src/upstream/scene/resources/material.cpp.excerpt) | `engine/godot-3.6/scene/resources/material.cpp:210-212, 362-1117, 1150-1154` |

校验和源码文件清单见 [src/README.md](src/README.md) 与 [src/SOURCE_SHA256.txt](src/SOURCE_SHA256.txt)。

## GDScript 源码复刻

`src/source_replay.gd` 用本代脚本基类和字段复刻这条链中的关键状态变化：材质参数写入、dirty 标记和 shader/RID 同步。模型不调用引擎私有 C++，只供逐步对照上方函数。

| GDScript 函数 | 对照步骤 |
| --- | --- |
| `_set_parameter()` | 更新材质参数字典。 |
| `_mark_dirty()` | 将 shader/material 状态标记为需同步。 |
| `_sync_material_rid()` | 清除 dirty 并推进模型代数。 |

## 最小 Godot/GDScript 实验

**实验：Material、Shader 与 Light 参数。** 给网格设置本代材质颜色；旧版 1/2 另设置 DirectionalLight 颜色，对照参数如何写入服务器状态。



- 项目入口：[`main.tscn`](main.tscn)
- 探针脚本：[`probe.gd`](probe.gd)
- 模型脚本：[`src/source_replay.gd`](src/source_replay.gd)


## 运行与观察

在本课目录使用与工程格式匹配的 Godot 程序启动：

```sh
godot --path .
```

**预期观察：** 启动后先打印 GDScript 模型中的状态转移，再执行本课公开 API 实验。模型打印用于检查调用顺序；只有引擎实际运行并留下日志后，才能把预期观察记为运行验证。

**动手改一处：** 按实验主题修改一个输入、尺寸、变换、材质或可见性参数；先预测状态/输出，再沿上方 C++ 链找出负责更新的函数。

## 简化与边界

模型只保留参数字典和 dirty 标记；真实 shader 编译、材质存储、渲染线程同步与后端资源生命周期未执行。

GDScript 教学模型只模拟状态传递，不是 C++ 的逐行翻译，也不执行引擎内部线程或 GPU 工作。

## 下一课

继续阅读 [s40_renderer_gles_backends](../s40_renderer_gles_backends/README.md)。

源码版权与许可说明见课程根目录 [SOURCE_LICENSE.txt](../SOURCE_LICENSE.txt)。
