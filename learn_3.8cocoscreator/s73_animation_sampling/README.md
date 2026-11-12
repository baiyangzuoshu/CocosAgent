# 第 73 课：Creator 3.8.7 关键帧采样与属性写回

**本课问题：** 时间如何转换成节点属性、SpriteFrame 或骨骼姿态？

## 本版路径

RealTrack 定位相邻关键帧并插值，AnimationState 写回目标属性。

## 源码位置

- [`real-track.ts`](<../../engine/3.8.7engine/cocos/animation/tracks/real-track.ts>)：对应 RealTrack 定位相邻关键帧并插值，AnimationState 写回目标属性。
- [`animation-curve.ts`](<../../engine/3.8.7engine/cocos/animation/animation-curve.ts>)：对应 RealTrack 定位相邻关键帧并插值，AnimationState 写回目标属性。
- [`animation-state.ts`](<../../engine/3.8.7engine/cocos/animation/animation-state.ts>)：对应 RealTrack 定位相邻关键帧并插值，AnimationState 写回目标属性。

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
