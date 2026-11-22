# 第 83 课：Creator 2.4.15 AnimationState、轨道与混合

**本课问题：** 播放、排队和混合怎样改变当前动画状态？

## 本版实现

setAnimation 替换指定播放单元，addAnimation 排队；mix 配置描述切换时长。

## 源码位置

- [Skeleton.js](../../engine/2.4.15engine/extensions/spine/Skeleton.js)：重点查看 setAnimation、addAnimation、setMix。
- [track-entry-listeners.js](../../engine/2.4.15engine/extensions/spine/track-entry-listeners.js)：重点查看 TrackEntry 回调转发。

## 为什么这样设计

轨道负责动画的替换和排队，TrackEntry 保存一次播放配置；Mix 配置描述旧状态到新状态的过渡时长。显式状态对象让事件回调和混合权重可跟踪。

## 源码流程图

```mermaid
flowchart TD
 A[setAnimation(track, clip)] --> B[替换轨道当前 TrackEntry]
 C[addAnimation(track, clip, delay)] --> D[加入轨道队列]
 B --> E[AnimationState.update]
 D --> E
 E --> F[当前 entry 推进时间]
 F --> G{当前完成?}
 G -->|否| F
 G -->|是| H[激活队列下一项]
 H --> I[按 Mix 配置过渡]
```

## 本课必须保留的机制

保留同一轨道中 `setAnimation` 替换当前项、`addAnimation` 排队后续项，以及 mix 时长描述切换过程的规则。

## 最小观察宿主

[`src/main.ts`](<src/main.ts>) 一次调用 `runLesson()`，把轨道队列与 mix 信息写入 `#log`；不需要场景或帧循环。

## 模型化简化与 Creator Runtime 边界

代码按 track 管理 TrackEntry，支持 set 替换、add 排队、loop 完成回调、mix duration 和过渡时间；超时切换时带入超出的 dt，且派发 start/complete/interrupt/dispose 观察事件。Spine 3.8 自带 AnimationState 的事件队列和 mix 链更完整，本模型保留主状态转移而不复制 Runtime。
## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000` 查看页面日志。前置课程：[第 82 课](../s82_spine_data_instance/README.md)。
