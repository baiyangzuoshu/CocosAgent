# 第 74 课：Creator 2.4.15 动画事件与完成回调

**本课问题：** 关键时刻和播放结束如何通知游戏逻辑？

## 本版路径

AnimationState 处理时间事件和完成回调。

## 源码位置

- [`animation-state.js`](<../../engine/2.4.15engine/cocos2d/animation/animation-state.js>)：对应 AnimationState 处理时间事件和完成回调。
- [`animation-manager.js`](<../../engine/2.4.15engine/cocos2d/animation/animation-manager.js>)：对应 AnimationState 处理时间事件和完成回调。
- [`CCAnimation.js`](<../../engine/2.4.15engine/cocos2d/core/components/CCAnimation.js>)：对应 AnimationState 处理时间事件和完成回调。

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
