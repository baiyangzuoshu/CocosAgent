# 第 35 课：Canvas 与屏幕坐标

**本课问题：** 设计分辨率如何通过 View 适配窗口，Canvas 如何连接 2D 渲染根节点与相机？

## 观察结果

设计分辨率为 960×640，窗口为 1280×720，使用 `SHOW_ALL`。缩放为 1.125，视口为 `(100, 0, 1080, 720)`；Canvas 中心映射到窗口中心 `(640, 360)`。Canvas 继承 `RenderRoot2D`，启用后按窗口和缩放调整相机正交高度及位置。浏览器页面只展示坐标，不是 Creator 渲染器。

## 源码位置

- [`View.setDesignResolutionSize`](../../engine/3.8.7engine/cocos/ui/view.ts#L436)：经分辨率策略更新缩放、视口和可见区域。
- [`Canvas`](../../engine/3.8.7engine/cocos/2d/framework/canvas.ts#L59)：继承 `RenderRoot2D`；[`_onResizeCamera`](../../engine/3.8.7engine/cocos/2d/framework/canvas.ts#L223) 按窗口尺寸和 View 缩放调整相机。
- [`UITransform`](../../engine/3.8.7engine/cocos/2d/framework/ui-transform.ts#L1)：Canvas 节点的 UI 尺寸由 UITransform 承载。
- [`Camera`](../../engine/3.8.7engine/cocos/misc/camera-component.ts#L106)：相机组件提供正交高度并挂载在 Node 上。

本课代码：[View](src/cocos/ui/view.ts)、[Canvas](src/cocos/2d/framework/canvas.ts)、[RenderRoot2D](src/cocos/2d/framework/render-root-2d.ts)、[UITransform](src/cocos/2d/framework/ui-transform.ts)、[Camera](src/cocos/misc/camera-component.ts)、[Node](src/cocos/scene-graph/node.ts)、[页面入口](src/main.ts)。

## 简化范围

示例只保留 `SHOW_ALL`、Canvas 根节点和相机屏幕对齐计算。省略完整分辨率策略、Camera 组件生命周期、渲染排序和 RenderPipeline；HTML/CSS 只负责展示计算结果。

## 运行

需要 Deno 和 Node.js 22.13 或更新版本。在本目录执行：

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>。
