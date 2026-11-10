# 第 35 课：Canvas 与屏幕坐标

**本课问题：** 设计分辨率如何通过 View 适配窗口，Canvas 节点如何成为 UI 的设计坐标根？

## 观察结果

设计分辨率为 960×640，窗口为 1280×720，Canvas 的两个适配选项都开启，对应 `SHOW_ALL`。缩放为 1.125，视口为 `(100, 0, 1080, 720)`；设计中心映射到窗口中心 `(640, 360)`。浏览器页面用 CSS 展示坐标关系，不是 Creator 渲染器。

## 源码位置

- [`CCCanvas.applySettings`](../../engine/2.4.15engine/cocos2d/core/components/CCCanvas.js#L206)：根据 `fitWidth`、`fitHeight` 选择策略，再调用 View。
- [`cc.view.setDesignResolutionSize`](../../engine/2.4.15engine/cocos2d/core/platform/CCView.js#L700)：应用策略，更新缩放、视口、可见区域并发出分辨率变化事件。

本课代码：[Canvas 组件](src/cocos2d/core/CCCanvas.ts)、[View](src/cocos2d/core/CCView.ts)、[Node](src/cocos2d/core/CCNode.ts)、[页面入口](src/main.ts)。

## 简化范围

示例固定 `fitWidth` 和 `fitHeight`，只实现 `SHOW_ALL` 及设计坐标到浏览器窗口坐标的换算。省略 Editor 分辨率拟合、其他策略细节、可见区域更新事件和 WebGL 渲染；HTML/CSS 只负责展示计算结果。

## 运行

需要 Deno 和 Node.js 22.13 或更新版本。在本目录执行：

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>。
