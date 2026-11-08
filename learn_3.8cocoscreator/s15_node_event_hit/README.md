# 第 15 课：节点命中与事件回调

**目标：** 看清输入如何命中节点，并触发节点回调。

## 本课增量

`NodeEventProcessor` 调用 `UITransform.hitTest` 检查节点范围，命中后调用节点的 touch-start 回调。 画布坐标先换到以画布中心为原点的示例世界坐标，再判断 Player 的 56×56 矩形。点击角色显示 `Player 收到 touch-start`，点击空白处显示 `未命中`。

## 源码位置

- `engine/3.8.7engine/cocos/scene-graph/node-event-processor.ts:638-655`：触摸开始时检查 UITransform，命中后派发节点事件。
- `engine/3.8.7engine/cocos/2d/framework/ui-transform.ts:460-512`：将输入位置转换后判断节点范围。
- `engine/3.8.7engine/cocos/input/input.ts:334-350`：输入事件进入分发流程。

## 简化

样例只处理一个活动节点和一个开始回调，节点只支持平移；矩形大小与上一课的 Sprite 四边形一致。省略相机、缩放、遮罩、节点排序及事件捕获与冒泡；后续再扩展传播。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，分别点击画面中的圆形角色和空白处，观察状态栏。
