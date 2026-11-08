# 第 14 课：浏览器输入坐标

**目标：** 理解浏览器输入如何进入引擎，并得到画布坐标。

## 本课增量

`MouseInputSource` 和 `TouchInputSource` 分别监听鼠标按下和触摸开始，记录来源、触摸 ID 和位置。 画布左下角为 `(0, 0)`：先减去画布位置，再根据画布实际尺寸缩放，并将 Y 轴翻转。点击或触摸画布，观察状态栏坐标。

## 源码位置

- `engine/3.8.7engine/pal/input/web/mouse-input.ts:74-97,133-173`：鼠标事件转换为引擎输入事件。
- `engine/3.8.7engine/pal/input/web/touch-input.ts:103-130`：触摸坐标相对画布换算。

## 简化

只处理按下/触摸开始，输出画布像素坐标；省略视口适配、旋转、触摸缓存、节点命中和事件传播。样例按画布 CSS 尺寸换算像素，完整引擎还会处理设备像素比及视图缩放。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，点击画布左下附近，坐标应接近 `(0, 0)`；右上附近接近 `(320, 200)`。
