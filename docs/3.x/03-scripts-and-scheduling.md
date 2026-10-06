# 3.8.7：组件脚本与执行时序

## 范围和官网基线

本文研究 3.8.7 的浏览器预览运行时。公开用法以 3.8 手册的[脚本创建](https://docs.cocos.com/creator/3.8/manual/zh/scripting/setup.html)、[装饰器](https://docs.cocos.com/creator/3.8/manual/zh/scripting/decorator.html)、[组件与执行顺序](https://docs.cocos.com/creator/3.8/manual/zh/scripting/component.html)、[生命周期](https://docs.cocos.com/creator/3.8/manual/zh/scripting/life-cycle-callbacks.html)和[计时器](https://docs.cocos.com/creator/3.8/manual/zh/scripting/scheduler.html)为准。脚本类继承 `Component`，用 `@ccclass` 注册，通过 `node.addComponent(MyComponent)` 创建组件；`@executionOrder` 控制五个主要生命周期回调的相对优先级，不控制 `onDisable/onDestroy`。

手册承诺 `onLoad` 首次激活、早于任何 `start`，`start` 早于第一次 `update`；组件 `schedule`/`scheduleOnce` 提供以秒计的计时器，`repeat=3` 总共调用四次。手册没有规定零延迟回调相对当前帧的精确位置，也没有规定 `update` 中新挂组件的 `start` 属于哪一帧；下文在 3.8.7 的源码和实际预览中分别核对。

## 对象与模块地图

`cocos/core/data/decorators/ccclass.ts` 与 `decorators/component.ts:48-65` 负责组件类和 `@executionOrder` 元数据；`cocos/scene-graph/component.ts:58-65,758-760` 保存类优先级。该示例 `3.8,7NewProject` 原本没有项目脚本，本次仅在预览页内存中创建测试组件，没有改工程资源、场景或 `.meta`。

```text
Node 激活或 node.addComponent
  → NodeActivator：批量 __preload、onLoad、onEnable
  → ComponentScheduler：start、update、lateUpdate
  → Director.tick：组件阶段 + 按优先级注册的 System 阶段
Component.schedule / scheduleOnce
  → Director.getScheduler() → Scheduler(System) → CallbackTimer
```

`scene-graph/node-activator.ts:158-183,196-245` 先递归收集，再分批执行组件的 `__preload/onLoad/onEnable`。`onLoad` 不以组件 `enabled` 为前提；`onEnable` 要求组件本身和节点层级均活动。`scene-graph/component-scheduler.ts:44-218,392-470` 维护负、零、正三个优先级队列，负/正按类的 `_executionOrder` 排序，默认零优先级保留登记顺序。这个排序只约束同一轮已收集的回调，不能跨越不同帧或不同激活任务创造全局顺序。

`ComponentScheduler` 以 `IsStartCalled` 使 `start` 至多执行一次；重新启用可以再次触发 `onEnable`，但不重跑已完成的 `onLoad/start`。`node-activator.ts:239-247` 仅在已完成 `onLoad` 的组件销毁时调用 `onDestroy`，与官网生命周期规则相符。

3.8 的 `Component` 将生命周期方法定义为受保护成员；供引擎内部访问的 `internalOnLoad`、`internalStart`、`internalUpdate` 等 getter 位于 `component.ts:534-630`。调度器登记时读 `internal*`，实际调用时执行组件方法（`component-scheduler.ts:260-320,473-550`）。因此用户仍实现手册中的 `onLoad/start/update`，不应把 `internal*` 当作项目脚本 API。

组件计时器沿 `component.ts:450-513` 委托 `director.getScheduler()`，组件作为目标。`component-scheduler.ts:392-418` 在启用和停用时恢复或暂停该目标的计时器；`component.ts:405-414` 在销毁前取消全部组件计时器。`core/scheduler.ts:225-312` 的 `CallbackTimer` 首次更新只初始化 `_elapsed=0`，之后才计算触发；`scheduleOnce(..., 0)` 仍需至少经过这个初始化过程。

`core/scheduler.ts:441-448` 在自己的 `update` 内按 `_timeScale` 缩放 `dt`，而 `Director.tick` 将原 `dt` 传给组件 `updatePhase`。因此通用 Scheduler 的 time scale 改变组件计时器计时速度，不等于直接改变组件 `update(dt)` 参数；这是源码推导，本次预览没有专门调节 time scale。

## 一帧内的路径

`cocos/game/director.ts:767-809` 的 `tick(dt)` 在浏览器预览按下列顺序调用：

```text
BEGIN_FRAME → 输入帧分发 → BEFORE_UPDATE
→ ComponentScheduler.startPhase
→ ComponentScheduler.updatePhase
→ 依优先级更新已注册 System（Scheduler 是其中之一）
→ ComponentScheduler.lateUpdatePhase
→ AFTER_UPDATE → CCObject._deferredDestroy
→ 各 System.postUpdate
→ BEFORE_DRAW → UI 脏标记更新与 Root.frameMove → AFTER_DRAW → END_FRAME
```

`Director.init`（`director.ts:850-866`）以优先级 200 注册 `Scheduler`。`Director.registerSystem` 与 `System.sortByPriority`（`core/system.ts:58-73`）使系统按优先级运行；其他系统相对计时器的顺序取决于实际注册及优先级，不宜单凭上述结构推断动画或物理的所有先后。这里与 2.x 最大的调度结构差别，是通用 `Scheduler` 通过系统列表更新，而非在主循环中直接调用。

`component-scheduler.ts:392-405,473-550` 在帧中启用新组件时，先放入 `_deferredComps`；帧尾 `lateUpdatePhase` 后 `_startForNewComps` 入队并运行 `start`，首次 `update/lateUpdate` 在下一帧。已活动节点上 `addComponent` 仍立即触发 `onLoad/onEnable`。`start` 因此不在 `addComponent` 的同步调用栈中，但可能仍属于本帧。

## 实际预览核对

2026-10-02 在 Creator 3.8.7 的 `3.8,7NewProject` Chrome 浏览器预览，控制台临时注册三个内存组件，并通过装饰器函数设置 A=0、B=-10、C=10。原始观测见[记录](../agent-foundation/traces/3.8.7-script-timing.jsonl)，验证流程见[skill 记录](../agent-foundation/skills/script-timing-validation.md)。当前标签页使用此前阶段的本机预览入口；这次探针仅使用页面运行时，没有修改工程与引擎文件。

同一次激活内，三个组件各自的 `onLoad/onEnable/start/第一次 update/第一次 lateUpdate` 均以 B→A→C 执行。三个 `onEnable` 中登记的零延迟 `scheduleOnce` 在下一帧、组件 `update` 后触发。销毁时实测 `onDisable/onDestroy` 是 A→B→C；手册只承诺它们不受 `executionOrder` 影响，不能从这一次顺序推出通用逆序规则。

在 Spawner 的 `update` 中添加 Target 时，`Target.onLoad/onEnable` 在那次 `update` 返回前发生；`Target.start` 在 Spawner 的 `lateUpdate` 后、本帧结束前发生；Target 的首次 `update`、零延迟计时器和 `lateUpdate` 在下一帧。这与源码的 `_deferredComps` 路径吻合。

## 对游戏开发者的意义与边界

- 组件脚本应保持 `@ccclass` 注册与节点创建路径。动态挂载到活动节点时，初始化回调可能同步改变对象状态；每帧逻辑从下一帧开始，`start` 则可能在当前帧收尾运行。
- 用 `@executionOrder` 控制同一轮主要生命周期回调；复杂依赖关系可以按手册由控制组件显式组织。不要从类优先级推断销毁顺序或不同时间独立激活的顺序。
- 定时器和组件 `update` 属于不同调度路径。排查缺失回调时检查组件/父节点激活、定时器目标暂停状态、是否已取消、首次 `CallbackTimer.update` 的初始化，以及相邻系统的优先级。

结论限于当前 3.8.7 TypeScript 运行时源码和这次编辑器 Chrome 预览。原生 C++ 后端、构建版、编辑器属性检查器的手动排序、项目脚本导入/热重载，以及具体动画/物理系统的完整帧序未由本实验覆盖。输入派发虽出现在 `tick` 中，事件命中和坐标转换仍留在阶段 5。
