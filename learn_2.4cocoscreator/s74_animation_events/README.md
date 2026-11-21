# 第 74 课：Creator 2.4.15 动画事件与完成回调

**本课问题：** 关键时刻和播放结束如何通知游戏逻辑？

## 本版路径

AnimationState 处理时间事件和完成回调。

## 源码位置

- [`animation-state.js`](<../../engine/2.4.15engine/cocos2d/animation/animation-state.js>)：对应 AnimationState 处理时间事件和完成回调。
- [`animation-manager.js`](<../../engine/2.4.15engine/cocos2d/animation/animation-manager.js>)：对应 AnimationState 处理时间事件和完成回调。
- [`CCAnimation.js`](<../../engine/2.4.15engine/cocos2d/core/components/CCAnimation.js>)：对应 AnimationState 处理时间事件和完成回调。

前置主题：[动作与时间推进](../s34_action_modifiers/README.md)。

## 为什么这样设计

事件与关键帧采样共享动画时间，但通知逻辑和属性赋值分开。以前后采样时间构成区间，可以只派发刚刚跨过的事件；结束通知则对应播放状态完成。

## 源码流程图

```mermaid
flowchart TD
 A[state.update previousTime/currentTime] --> B[扫描 AnimationClip events]
 B --> C{event 在 (previous,current]?}
 C -->|是| D[派发动画事件]
 C -->|否| E[跳过]
 D --> F[更新 previousTime]
 E --> F
 F --> G{播放完成?}
 G -->|是| H[派发 finished 回调]
```

## 本课必须保留的机制

保留事件时间窗口 `(previous, current]`：前一采样点之后、当前采样点及之前的事件各触发一次，并更新前一时间。

## 最小观察宿主

`src/main.ts` 一次调用 `runLesson()`，以固定 `0.2s→0.8s` 时间窗打印命中的事件；不需要场景或帧循环。

## 模型化简化与 Creator Runtime 边界

课程代码维护上一采样时间和监听器，只在事件时间跨越区间 `(previousTime, currentTime]` 时派发，并在播放到时长后触发完成回调。它不处理循环回绕，也不接入 Creator Runtime 的 `AnimationState`/`CCAnimation`。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000`，页面列出本课的时间、采样或事件结果。
