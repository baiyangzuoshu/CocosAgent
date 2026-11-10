# 第 38 课：Label 文本更新

**本课问题：** 修改 `Label.string` 后，渲染器如何获知文本需要重建？

## 观察结果

点击按钮把 `Score 9` 改成 `Score 10`。字符串 setter 标记顶点数据为脏并登记到 UIRendererManager；管理器更新时调用 Label assembler。固定字宽只是教学模型，不是实际字体测量。

## 源码位置

- [Label.string](../../engine/3.8.7engine/cocos/2d/components/label.ts#L222)：文本变化后调用 `_markForUpdateRenderData`。
- [UIRenderer._markForUpdateRenderData](../../engine/3.8.7engine/cocos/2d/framework/ui-renderer.ts#L433)：设置 `vertDirty` 并通知渲染器管理器。
- [Label.updateRenderData](../../engine/3.8.7engine/cocos/2d/components/label.ts#L961)：把更新交给 assembler。

本课代码按职责拆分：[Label](src/cocos/2d/components/label.ts)、[UIRendererManager](src/cocos/2d/framework/ui-renderer-manager.ts)、[LabelAssembler](src/cocos/2d/renderer/label-assembler.ts)、[入口](src/main.ts)。

## 简化范围

只保留文本变更、渲染器脏队列和 assembler 更新。省略字体资源、字形缓存、顶点缓冲和 RenderGraph 提交；网页用 DOM 展示状态，不是 Creator 引擎运行时。

## 运行

需要 Deno 和 Node.js 22.13 或更新版本。在本目录执行：

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>。
