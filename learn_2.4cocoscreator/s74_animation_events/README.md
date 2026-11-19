# 第 74 课：Creator 2.4.15 动画事件与完成回调

**本课问题：** 关键时刻和播放结束如何通知游戏逻辑？

## 本版路径

AnimationState 处理时间事件和完成回调。

## 源码位置

- [`animation-state.js`](<../../engine/2.4.15engine/cocos2d/animation/animation-state.js>)：对应 AnimationState 处理时间事件和完成回调。
- [`animation-manager.js`](<../../engine/2.4.15engine/cocos2d/animation/animation-manager.js>)：对应 AnimationState 处理时间事件和完成回调。
- [`CCAnimation.js`](<../../engine/2.4.15engine/cocos2d/core/components/CCAnimation.js>)：对应 AnimationState 处理时间事件和完成回调。

前置主题：[动作与时间推进](../s34_action_modifiers/README.md)。

## 本课必须保留的机制

保留事件时间窗口 `(previous, current]`：前一采样点之后、当前采样点及之前的事件各触发一次，并更新前一时间。

## 最小观察宿主

`src/main.ts` 一次调用 `runLesson()`，以固定 `0.2s→0.8s` 时间窗打印命中的事件；不需要场景或帧循环。

## 模型化简化与 Creator Runtime 边界

[AnimationStudy.ts](<src/cocos2d/animation/AnimationStudy.ts>) 只筛选静态事件数组，不维护动画轨道、循环边界或回调监听；未接入 Runtime `AnimationState` 在时间推进中派发事件并由 `CCAnimation`/游戏逻辑接收的阶段。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000`，页面列出本课的时间、采样或事件结果。
