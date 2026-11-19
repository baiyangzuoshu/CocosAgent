# 第 83 课：Creator 2.4.15 AnimationState、轨道与混合

**本课问题：** 播放、排队和混合怎样改变当前动画状态？

## 本版实现

setAnimation 替换指定播放单元，addAnimation 排队；mix 配置描述切换时长。

## 源码位置

- [Skeleton.js](../../engine/2.4.15engine/extensions/spine/Skeleton.js)：重点查看 setAnimation、addAnimation、setMix。
- [track-entry-listeners.js](../../engine/2.4.15engine/extensions/spine/track-entry-listeners.js)：重点查看 TrackEntry 回调转发。

## 本课必须保留的机制

保留同一轨道中 `setAnimation` 替换当前项、`addAnimation` 排队后续项，以及 mix 时长描述切换过程的规则。

## 最小观察宿主

[`src/main.ts`](<src/main.ts>) 一次调用 `runLesson()`，把轨道队列与 mix 信息写入 `#log`；不需要场景或帧循环。

## 模型化简化与 Creator Runtime 边界

[`SpineStudy.ts`](<src/extensions/spine/SpineStudy.ts>) 仅打印一条手工构造的轨道/混合示例，不创建 Spine `AnimationState`、不推进时间、不触发 TrackEntry 回调；省略 Runtime 对轨道队列和 mix 时长的实际处理阶段。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000` 查看页面日志。前置课程：[第 82 课](../s82_spine_data_instance/README.md)。
