# 图形渲染 skill 试用记录

候选：[2.4 渲染追踪](cocos2-rendering-trace/SKILL.md) · [3.8 渲染追踪](cocos3-rendering-trace/SKILL.md)。两版均先按各自官方渲染手册确认开发者可见概念，再以本地源码定位调用链。

## 正常案例

| 任务 | 路由与真实观察 | 能支持的结论 |
| --- | --- | --- |
| 2.4 的 Sprite 移动或换材质后怎样绘制？ | 在 `2.4.15NewProject` Web 预览，临时移动 `cocos` Sprite、替换灰度材质并恢复；[轨迹](../traces/2.4.15-graphics-rendering.jsonl)记录 `_renderFlag`、材质名、帧事件及场景 draw call。 | `RenderFlow` 下一帧消耗变换标志；材质通过组件的 `MaterialVariant` 更新；本场景灰度材质使该帧 draw call 3→4。 |
| 3.8 的 MeshRenderer 移动或换材质后怎样绘制？ | 在 `3.8,7NewProject` Web 预览，临时移动 `islands` 模型、切换共享材质并恢复；[轨迹](../traces/3.8.7-graphics-rendering.jsonl)记录 Model 边界、SubModel Pass 身份、Builtin builder 分支及场景 draw call。 | Model 边界在后续渲染帧更新；`setSharedMaterial` 切换 SubModel Pass；`getMaterialInstance` 惰性创建组件实例；当前 Camera 进入 Builtin 的完整 forward 分支。 |

两个探针都是已打开编辑器提供的桌面 Chrome 浏览器预览。它们使用 DevTools 内存对象，不改工程或引擎源文件；临时设置在回调中恢复，记录完成后两页预览均已重载。JSONL 是控制台输出的结构化转录，`seq` 仅表示记录顺序，不能作为帧耗时或 GPU 性能指标。2.4 的 3 draw 和 3.8 的 49 draw 分别属于各自场景，不能比较两版效率。

## 易混淆案例

| 问题 | skill 应作出的判断 | 核查 |
| --- | --- | --- |
| “切一个材质必定多一次 draw call？” | 先查组件材质所有权、Pass、相邻批次，再量测当前场景；不把 2.4 灰度材质实验普遍化。 | 2.4 此处 3→4；3.8 `seafloor`→`stone` 此处仍为 49。 |
| “3.8 改材质直接调用 `getMaterial` 还是 `getSharedMaterial`？” | 对照 3.8 手册与本地 3.8.7 的弃用标记，明确 shared 和 instance 的用途。 | `getMaterialInstance` 前后身份与 SubModel Pass 关系已在 Web 预览实测。 |
| “两个版本都走相同 forward renderer 吗？” | 分别识别当前 renderer 与管线；2.4 这个 2D Sprite 走 RenderFlow/ModelBatcher/ForwardRenderer，3.8 这个 3D Mesh 走 RenderScene/Builtin WebPipeline。 | 本地源码与运行时 `WebPipeline`、`BuiltinPipelineBuilder` 身份匹配；不外推 2.4 Mesh 或 3.8 2D 路径。 |

## 证据边界与收口

同一开发行为“变换或材质变更后进入当前示例的 Web 绘制路径”已由两版手册、源码与实际预览独立闭环。两份 skill 的使用范围限定在各自版本；2.4 3D、3.8 2D UI 合批、完整光照/阴影各 Pass、自定义 builder 和 Native GFX 尚未做同等级运行验证。阶段 7 深入 2D/UI，阶段 10 核对原生后端；后续如要给出 GPU 时间或单对象绘制归因，需单独的渲染调试/抓帧证据。
