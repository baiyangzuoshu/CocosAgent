# 第 72 课：Creator 2.4.15 播放状态与时间推进

**本课问题：** 播放、暂停、循环和结束如何进入每帧更新？

## 本版路径

AnimationManager 每帧推进 AnimationState 时间，按循环模式处理结束。

## 源码位置

- [`animation-state.js`](<../../engine/2.4.15engine/cocos2d/animation/animation-state.js>)：对应 AnimationManager 每帧推进 AnimationState 时间，按循环模式处理结束。
- [`animation-manager.js`](<../../engine/2.4.15engine/cocos2d/animation/animation-manager.js>)：对应 AnimationManager 每帧推进 AnimationState 时间，按循环模式处理结束。

前置主题：[动作与时间推进](../s34_action_modifiers/README.md)。

## 本课必须保留的机制

保留播放状态按时间推进、达到总循环时长后停止并标记结束的规则；源码还展示 AnimationManager 在每帧推进 AnimationState 的职责。

## 最小观察宿主

`src/main.ts` 一次调用 `runLesson()`，用固定的 `0.2s` 与 `0.5s` 步长显示时间、采样序号和结束状态；没有交互控制或真实帧循环。

## 模型化简化与 Creator Runtime 边界

[AnimationStudy.ts](<src/cocos2d/animation/AnimationStudy.ts>) 使用自定义 `AnimationState`，只按 `duration × loops` 截止，不执行真实暂停/循环回绕、关键帧采样或目标写回；未接入 Creator Runtime 的 `AnimationManager` 帧调度与状态更新阶段。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000`，页面列出本课的时间、采样或事件结果。
