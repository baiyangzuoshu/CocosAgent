# 第 36 课：Widget 对齐

**本课问题：** 父节点尺寸变化时，Widget 怎样按边距重新定位子节点？

## 观察结果

Button 尺寸为 160×64，锚点为中心，右边距 24，垂直居中。父节点从 960×640 调整为 1280×720 后，中心从 `(856, 320)` 移到 `(1176, 360)`。resize 先将 Widget 标脏，`AFTER_UPDATE` 阶段再重算位置；需要同帧结果时可调用 `updateAlignment()`。

## 源码位置

- [`CCWidget.alignMode`](../../engine/2.4.15engine/cocos2d/core/components/CCWidget.js#L516) 默认是 `ON_WINDOW_RESIZE`；[`updateAlignment`](../../engine/2.4.15engine/cocos2d/core/components/CCWidget.js#L662) 提供立即更新入口。
- [`CCWidgetManager.align`](../../engine/2.4.15engine/cocos2d/core/base-ui/CCWidgetManager.js#L95) 根据父节点尺寸、父子锚点和 right offset 算位置；[`refreshWidgetOnResized`](../../engine/2.4.15engine/cocos2d/core/base-ui/CCWidgetManager.js#L488) 响应 resize 并安排下一次更新。

本课代码：[CCWidget](src/cocos2d/core/components/CCWidget.ts)、[CCWidgetManager](src/cocos2d/core/base-ui/CCWidgetManager.ts)、[CCNode](src/cocos2d/core/CCNode.ts)、[页面入口](src/main.ts)。

## 简化范围

只实现父节点右边距、垂直中心和 `ON_WINDOW_RESIZE` 路径。省略可选 target、百分比边距、拉伸、缩放变换、编辑器拖动规则及完整场景遍历。页面图示按统一比例展示计算结果，不是引擎渲染画面。

## 运行

需要 Deno 和 Node.js 22.13 或更新版本。在本目录执行：

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>。
