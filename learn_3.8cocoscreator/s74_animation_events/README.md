# 第 74 课：Creator 3.8.7 动画事件与完成回调

**本课问题：** 关键时刻和播放结束如何通知游戏逻辑？

## 本版路径

AnimationState 与 EventEmitter 派发动画事件和结束通知。

## 源码位置

- [`event-emitter.ts`](<../../engine/3.8.7engine/cocos/animation/event/event-emitter.ts>)：对应 AnimationState 与 EventEmitter 派发动画事件和结束通知。
- [`animation-state.ts`](<../../engine/3.8.7engine/cocos/animation/animation-state.ts>)：对应 AnimationState 与 EventEmitter 派发动画事件和结束通知。

前置主题：[动作与时间推进](../s34_action_modifiers/README.md)。

## 独立代码与简化

[AnimationStudy.ts](<src/cocos/animation/AnimationStudy.ts>) 与 [入口](<src/main.ts>)。浏览器示例运行简化播放器，不加载编辑器生成的 AnimationClip 或 AnimationGraph 资源。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000`，页面列出本课的时间、采样或事件结果。
