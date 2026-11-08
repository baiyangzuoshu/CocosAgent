# 第 15 课：节点命中与事件回调

**目标：** 看清输入如何命中节点，并触发节点回调。

## 本课增量

`CCEventManager` 将输入交给监听节点，`Node._hitTest` 检查范围，命中后调用节点的 touch-start 回调。 画布坐标先换到以画布中心为原点的示例世界坐标，再判断 Player 的 56×56 矩形。点击角色显示 `Player 收到 touch-start`，点击空白处显示 `未命中`。

## 源码位置

- `engine/2.4.15engine/cocos2d/core/CCNode.js:462-473,2384-2412`：触摸开始时检查节点矩形，命中后派发事件。
- `engine/2.4.15engine/cocos2d/core/event-manager/CCEventManager.js:493-513,1025-1045`：调用监听器并分发事件。

## 简化

样例只处理一个活动节点和一个开始回调，节点只支持平移；矩形大小与上一课的 Sprite 四边形一致。省略相机、缩放、遮罩、节点排序及事件捕获与冒泡；后续再扩展传播。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，分别点击画面中的圆形角色和空白处，观察状态栏。
