# 第 15 课：输入命中与目标回调

**问题：** 输入点已经换到画布 backing-store 坐标后，怎样决定哪个节点收到触摸？

## 观察步骤

1. 点击黄色 `HitTarget` 方框中心，观察坐标、AABB 判定、管理器结果和回调。
2. 点击方框以外，确认本例没有命中，也不会派发 touch-start。
3. 注意方框只是 CSS 叠层；真正命中由节点模型计算，不是浏览器在 Sprite 上做拾取。

当前页面 CSS 尺寸与 backing-store 都是 320×200，所以 s14 已讲的 CSS→backing-store 比例为 1；本课从 backing-store 点开始，减去画布中心得到世界点。

## 本课必须保留的机制

`CCInputManager` 收到 mouse/touch-start → `InputPoint` 提供 backing-store 坐标 → 转成中心原点坐标 → `CCEventManager` 逐个询问监听节点 `_hitTest` → 首个命中节点派发 touch-start 回调。节点必须 `activeInHierarchy`，命中框为节点世界中心周围 `|dx|≤28 && |dy|≤28`。

## 最小观察宿主

一个 canvas 输入面、一个 Scene/Director 主循环用于激活场景、一个活动 `HitTarget`、单个监听器和文本状态区。DOM 不绘制游戏图形，CSS 方框只作定位标记。

## Creator 2.4.15 源码对照

- [CCInputManager.js](../../engine/2.4.15engine/cocos2d/core/platform/CCInputManager.js)：输入事件与画布坐标处理。
- [CCEventManager.js](../../engine/2.4.15engine/cocos2d/core/event-manager/CCEventManager.js#L552-L585)：排序并派发触摸监听器；`onTouchBegan` 可 claim、swallow 或停止派发。
- [CCNode.js](../../engine/2.4.15engine/cocos2d/core/CCNode.js#L462-L474)：命中后生成触摸事件并调用节点事件分发；[#_hitTest](../../engine/2.4.15engine/cocos2d/core/CCNode.js#L2384-L2441) 处理 Camera、world matrix、content size、anchor 和可选 Mask。

## 模型化简化与 Creator Runtime 边界

本课的 `CCEventManager` 是同名教学模型：只有一个节点列表和首个命中即返回，没有 Runtime 的监听器优先级、吞噬、claim、多点触摸与待处理监听器变更。`_hitTest` 是固定 56×56 AABB，不实现 Creator 的 Camera 转换、节点旋转/缩放、content size/anchor 与 Mask。坐标转换复用 s14 的简化规则；没有实现完整 View、viewport、DPR 与旋转链路。本课不渲染 Sprite。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~
