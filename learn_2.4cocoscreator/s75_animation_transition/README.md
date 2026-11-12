# 第 75 课：Creator 2.4.15 动画组合与过渡

**本课问题：** 各版本怎样组合、叠加或过渡动画？

## 本版路径

Animation.playAdditive 启动额外 AnimationState。

## 源码位置

- [`CCAnimation.js`](<../../engine/2.4.15engine/cocos2d/core/components/CCAnimation.js>)：对应 Animation.playAdditive 启动额外 AnimationState。
- [`animation-state.js`](<../../engine/2.4.15engine/cocos2d/animation/animation-state.js>)：对应 Animation.playAdditive 启动额外 AnimationState。
- [`playable.js`](<../../engine/2.4.15engine/cocos2d/animation/playable.js>)：对应 Animation.playAdditive 启动额外 AnimationState。

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
