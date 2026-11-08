# 第 14 课：浏览器输入坐标

**目标：** 理解浏览器输入如何进入引擎，并得到画布坐标。

## 本课增量

`CCInputManager.registerSystemEvent` 监听鼠标按下和触摸开始，记录来源、触摸 ID 和位置。 画布左下角为 `(0, 0)`：先减去画布位置，再根据画布实际尺寸缩放，并将 Y 轴翻转。点击或触摸画布，观察状态栏坐标。

## 源码位置

- `engine/2.4.15engine/cocos2d/core/platform/CCInputManager.js:151-180,400-449,459-509`：注册浏览器输入并创建触摸数据。
- `engine/2.4.15engine/cocos2d/core/platform/CCInputManager.js:577-595`：触摸开始进入 `handleTouchesBegin`。

## 简化

只处理按下/触摸开始，输出画布像素坐标；省略视口适配、旋转、触摸缓存、节点命中和事件传播。样例按画布 CSS 尺寸换算像素，完整引擎还会处理设备像素比及视图缩放。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，点击画布左下附近，坐标应接近 `(0, 0)`；右上附近接近 `(320, 200)`。
