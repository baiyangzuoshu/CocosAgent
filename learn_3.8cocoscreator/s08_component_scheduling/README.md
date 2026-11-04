# 第 8 课：组件每帧调度

**目标：** 看清 `ComponentScheduler` 怎样按 `start → update → lateUpdate` 调度组件。

## 本课增量

组件激活时，`Component` 把启用状态交给 `ComponentScheduler`。Director 每帧依次执行三个阶段：`start` 只执行一次，`update` 和 `lateUpdate` 每帧执行。组件停用时 Scheduler 移除后续更新并调用 `onDisable`。

## 源码位置

- `engine/3.8.7engine/cocos/scene-graph/component-scheduler.ts:351-425`、`:503-550`：启用、回调注册及三个生命周期阶段。
- `engine/3.8.7engine/cocos/scene-graph/node-activator.ts:195-232`：节点激活时由 ComponentScheduler 启用组件。
- `engine/3.8.7engine/cocos/game/director.ts:774-788`：Director 每帧按顺序运行组件和系统更新。

## 简化

保留 `Director → ComponentScheduler → Component` 的职责和阶段顺序。省略优先级、编辑器异常包装、帧内新增组件的延迟处理、通用 Invoker 优化和系统调度。

## 运行

进入本课目录运行 `deno task check`、`deno task build` 和 `deno task serve`，打开 <http://localhost:8000>。页面显示首帧的 `start → update → lateUpdate`，之后每帧重复后两项。
