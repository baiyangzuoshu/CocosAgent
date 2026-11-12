# 第 72 课：Creator 2.4.15 播放状态与时间推进

**本课问题：** 播放、暂停、循环和结束如何进入每帧更新？

## 本版路径

AnimationManager 每帧推进 AnimationState 时间，按循环模式处理结束。

## 源码位置

- [`animation-state.js`](<../../engine/2.4.15engine/cocos2d/animation/animation-state.js>)：对应 AnimationManager 每帧推进 AnimationState 时间，按循环模式处理结束。
- [`animation-manager.js`](<../../engine/2.4.15engine/cocos2d/animation/animation-manager.js>)：对应 AnimationManager 每帧推进 AnimationState 时间，按循环模式处理结束。

前置主题：[动作与时间推进](../s34_action_modifiers/README.md)。

## 独立代码与简化

[AnimationStudy.ts](<src/cocos2d/animation/AnimationStudy.ts>) 与 [入口](<src/main.ts>)。浏览器示例运行简化播放器，不读取 Creator 编辑器序列化的动画资源。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000`，页面列出本课的时间、采样或事件结果。
