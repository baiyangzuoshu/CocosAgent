# 第 72 课：Creator 3.8.7 播放状态与时间推进

**本课问题：** 播放、暂停、循环和结束如何进入每帧更新？

## 本版路径

AnimationComponent 控制 AnimationState，系统每帧推进状态时间。

## 源码位置

- [`animation-state.ts`](<../../engine/3.8.7engine/cocos/animation/animation-state.ts>)：对应 AnimationComponent 控制 AnimationState，系统每帧推进状态时间。
- [`animation-component.ts`](<../../engine/3.8.7engine/cocos/animation/animation-component.ts>)：对应 AnimationComponent 控制 AnimationState，系统每帧推进状态时间。

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
