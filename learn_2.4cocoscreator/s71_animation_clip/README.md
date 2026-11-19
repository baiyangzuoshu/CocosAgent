# 第 71 课：Creator 2.4.15 动画资源与片段

**本课问题：** 各版本的动画数据如何进入运行时播放器？

## 本版路径

CCAnimation 组件持有 AnimationClip 并创建可播放状态。

## 源码位置

- [`animation-clip.js`](<../../engine/2.4.15engine/cocos2d/animation/animation-clip.js>)：对应 CCAnimation 组件持有 AnimationClip 并创建可播放状态。
- [`CCAnimation.js`](<../../engine/2.4.15engine/cocos2d/core/components/CCAnimation.js>)：对应 CCAnimation 组件持有 AnimationClip 并创建可播放状态。

前置主题：[动作与时间推进](../s34_action_modifiers/README.md)。

## 本课必须保留的机制

保留 `CCAnimation` 持有 `AnimationClip` 并创建可播放状态这一资源到播放器的连接；课程关注的是 Clip 进入运行时的入口，而不只是时间数值。

## 最小观察宿主

`src/main.ts` 一次调用 `runLesson()`，把 Clip 名称、时长和关键帧数写入浏览器 `#log`；不需要场景、按钮或帧循环。

## 模型化简化与 Creator Runtime 边界

[AnimationStudy.ts](<src/cocos2d/animation/AnimationStudy.ts>) 是静态数据模型，只打印 `{name, duration, keys}`，不解析 Creator 序列化资源，也不创建真实 `CCAnimation/AnimationState`。因此未执行资源加载后由 `CCAnimation` 接入并由 `AnimationManager` 推进状态的 Runtime 阶段。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000`，页面列出本课的时间、采样或事件结果。
