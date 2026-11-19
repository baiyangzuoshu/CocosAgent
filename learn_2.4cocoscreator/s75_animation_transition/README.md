# 第 75 课：Creator 2.4.15 动画组合与过渡

**本课问题：** 各版本怎样组合、叠加或过渡动画？

## 本版路径

Animation.playAdditive 启动额外 AnimationState。

## 源码位置

- [`CCAnimation.js`](<../../engine/2.4.15engine/cocos2d/core/components/CCAnimation.js>)：对应 Animation.playAdditive 启动额外 AnimationState。
- [`animation-state.js`](<../../engine/2.4.15engine/cocos2d/animation/animation-state.js>)：对应 Animation.playAdditive 启动额外 AnimationState。
- [`playable.js`](<../../engine/2.4.15engine/cocos2d/animation/playable.js>)：对应 Animation.playAdditive 启动额外 AnimationState。

前置主题：[动作与时间推进](../s34_action_modifiers/README.md)。

## 本课必须保留的机制

保留基础动画状态与 additive 状态并存、各自具有权重的机制；源码主题是 `Animation.playAdditive` 启动额外 `AnimationState`，不是简单替换当前状态。

## 最小观察宿主

`src/main.ts` 一次调用 `runLesson()`，输出两个状态名称及权重；无需场景、交互或帧循环。

## 模型化简化与 Creator Runtime 边界

[AnimationStudy.ts](<src/cocos2d/animation/AnimationStudy.ts>) 仅用 Map 记录 base/additive 名称与权重，不推进时间、不采样动画、不计算混合后姿态；未执行 `CCAnimation.playAdditive` 创建并由 `AnimationManager` 更新多个状态的 Runtime 阶段。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000`，页面列出本课的时间、采样或事件结果。
