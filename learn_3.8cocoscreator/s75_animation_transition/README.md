# 第 75 课：Creator 3.8.7 动画组合与过渡

**本课问题：** 各版本怎样组合、叠加或过渡动画？

## 本版路径

Animation.crossFade 交给 CrossFade；Marionette 另有状态图求值路径。

## 源码位置

- [`animation-component.ts`](<../../engine/3.8.7engine/cocos/animation/animation-component.ts>)：对应 Animation.crossFade 交给 CrossFade；Marionette 另有状态图求值路径。
- [`cross-fade.ts`](<../../engine/3.8.7engine/cocos/animation/cross-fade.ts>)：对应 Animation.crossFade 交给 CrossFade；Marionette 另有状态图求值路径。
- [`state-machine-eval.ts`](<../../engine/3.8.7engine/cocos/animation/marionette/state-machine/state-machine-eval.ts>)：对应 Animation.crossFade 交给 CrossFade；Marionette 另有状态图求值路径。

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
