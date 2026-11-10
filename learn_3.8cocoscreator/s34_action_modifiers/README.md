# 第 34 课：缓动、重复与反向时间

**本课问题：** 间隔动作的归一化进度，如何被动作包装器或 Tween 缓动配置改写？

## 观察结果

页面同时运行四条动作：线性进度、t² EaseIn、把 0.4 秒动作重复三次，以及将内层进度映射为 1 - t 的 ReverseTime。总进度为 0.5 时，线性值为 0.5，EaseIn 为 0.25；Repeat 同时显示当前轮次和该轮局部进度。

## 源码位置

- `engine/3.8.7engine/cocos/tween/tween-action.ts`：[`TweenAction`](../../engine/3.8.7engine/cocos/tween/tween-action.ts#L105) 处理全局或逐属性 easing，并在 [`update`](../../engine/3.8.7engine/cocos/tween/tween-action.ts#L366) 插值目标属性。
- `engine/3.8.7engine/cocos/tween/actions/action-interval.ts`：[`Repeat.update`](../../engine/3.8.7engine/cocos/tween/actions/action-interval.ts#L513) 切分周期；[`ReverseTime.update`](../../engine/3.8.7engine/cocos/tween/actions/action-interval.ts#L1059) 传入 `1 - dt`。
- `engine/3.8.7engine/cocos/tween/tween.ts`：[`repeat`](../../engine/3.8.7engine/cocos/tween/tween.ts#L656) 与 [`reverseTime`](../../engine/3.8.7engine/cocos/tween/tween.ts#L715) 是 Tween 链式入口。

本课代码：[Tween 进度动作](src/cocos/tween/tween-action.ts)、[重复与反向包装器](src/cocos/tween/actions/action-interval.ts)、[演示入口](src/main.ts)。

## 简化范围

本课 TweenAction 用回调显示进度；引擎版本处理目标对象属性、插值和逐属性配置。Repeat 只包装间隔动作，省略即时动作、克隆、速度系数、引用管理和完整停止流程。暂停、停止及节点离场清理属于动作管理器与节点生命周期，本课只研究进度映射。

## 运行

需要 Deno 和 Node.js 22.13 或更新版本。在本目录执行：

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>。
