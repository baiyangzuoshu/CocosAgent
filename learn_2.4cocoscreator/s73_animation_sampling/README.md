# 第 73 课：Creator 2.4.15 关键帧采样与属性写回

**本课问题：** 时间如何转换成节点属性、SpriteFrame 或骨骼姿态？

## 本版路径

AnimationCurves 按时间采样关键帧，再把结果写回目标属性。

## 源码位置

- [`animation-curves.js`](<../../engine/2.4.15engine/cocos2d/animation/animation-curves.js>)：对应 AnimationCurves 按时间采样关键帧，再把结果写回目标属性。
- [`animation-state.js`](<../../engine/2.4.15engine/cocos2d/animation/animation-state.js>)：对应 AnimationCurves 按时间采样关键帧，再把结果写回目标属性。

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
