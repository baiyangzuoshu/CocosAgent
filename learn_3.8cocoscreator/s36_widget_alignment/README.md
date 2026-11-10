# 第 36 课：Widget 对齐

**本课问题：** 父节点尺寸变化时，Widget 如何用 UITransform 的尺寸和锚点重算位置？

## 观察结果

Button 尺寸为 160×64，锚点为中心，右边距 24，垂直居中。父节点从 960×640 调整为 1280×720 后，中心从 `(856, 320)` 移到 `(1176, 360)`。resize 先把 Widget 标脏；`AFTER_UPDATE` 处理脏 Widget。需要同帧结果时可调用 `updateAlignment()`。

## 源码位置

- [`Widget.updateAlignment`](../../engine/3.8.7engine/cocos/ui/widget.ts#L813) 请求立即对齐；默认模式为 `ON_WINDOW_RESIZE`（[`_alignMode`](../../engine/3.8.7engine/cocos/ui/widget.ts#L790)）。
- [`widget-manager.align`](../../engine/3.8.7engine/cocos/ui/widget-manager.ts#L45) 读取父子 UITransform 与锚点计算位置；[`refreshScene`](../../engine/3.8.7engine/cocos/ui/widget-manager.ts#L229) 在 `AFTER_UPDATE` 对齐脏节点；[`refreshWidgetOnResized`](../../engine/3.8.7engine/cocos/ui/widget-manager.ts#L307) 处理 resize。

本课代码：[Widget](src/cocos/ui/widget.ts)、[WidgetManager](src/cocos/ui/widget-manager.ts)、[UITransform](src/cocos/2d/framework/ui-transform.ts)、[Node](src/cocos/scene-graph/node.ts)、[页面入口](src/main.ts)。

## 简化范围

只实现父节点右边距、垂直中心和 `ON_WINDOW_RESIZE` 路径。省略 target 变换、百分比边距、拉伸、负缩放和引擎组件生命周期。页面图示按统一比例展示计算结果，不是引擎渲染画面。

## 运行

需要 Deno 和 Node.js 22.13 或更新版本。在本目录执行：

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>。
