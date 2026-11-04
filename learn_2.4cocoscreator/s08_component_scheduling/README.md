# 第 8 课：组件每帧调度

**目标：** 看清 `ComponentScheduler` 怎样按 `start → update → lateUpdate` 调度组件。

## 本课增量

组件激活时，`Component` 把启用状态交给 `ComponentScheduler`。Director 每帧依次执行三个阶段：`start` 只执行一次，`update` 和 `lateUpdate` 每帧执行。组件停用时 Scheduler 移除后续更新并调用 `onDisable`。

## 源码位置

- `engine/2.4.15engine/cocos2d/core/component-scheduler.js:309-360`、`:404-519`：Invoker 注册和三个生命周期阶段。
- `engine/2.4.15engine/cocos2d/core/node-activator.js:313-350`、`:353-365`：激活组件时启用 Scheduler，反激活时停用。
- `engine/2.4.15engine/cocos2d/core/CCDirector.js:842-858`：Director 每帧调用 start、update、lateUpdate 阶段。

## 简化

保留 `Director → ComponentScheduler → Component` 的职责和阶段顺序。省略 executionOrder、编辑器异常包装、帧内新增组件的延迟处理、通用 invoker 优化和系统调度。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>。页面显示首帧的 `start → update → lateUpdate`，之后每帧重复后两项。
