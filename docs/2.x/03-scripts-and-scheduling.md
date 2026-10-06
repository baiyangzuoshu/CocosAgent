# 2.4.15：组件脚本与执行时序

## 范围和官网基线

本文研究 2.4.15 的浏览器预览运行时。公开用法以 2.4 手册的[创建组件脚本](https://docs.cocos.com/creator/2.4/manual/zh/scripting/use-component.html)、[cc.Class](https://docs.cocos.com/creator/2.4/manual/zh/scripting/class.html)、[生命周期](https://docs.cocos.com/creator/2.4/manual/zh/scripting/life-cycle-callbacks.html)、[执行顺序](https://docs.cocos.com/creator/2.4/manual/zh/scripting/execution-order.html)和[计时器](https://docs.cocos.com/creator/2.4/manual/zh/scripting/scheduler.html)为准。手册把组件脚本视作附着在节点上的组件：`cc.Class({ extends: cc.Component, ... })` 声明，节点负责实例；`onLoad` 在首次激活时执行且先于 `start`，`start` 先于第一次 `update`；`schedule`/`scheduleOnce` 属于组件，`repeat` 表示额外重复次数，因此总调用数为 `repeat + 1`。

2.4 手册允许在同一节点通过属性检查器排列组件，或在 `editor.executionOrder` 写数值优先级；该优先级只影响 `onLoad`、`onEnable`、`start`、`update`、`lateUpdate`。手册没有规定定时器相对这些回调的精确帧位置，也没有规定帧中新增组件的 `start` 落在哪一帧。这两点由下文源码和实际预览给出当前环境的证据。

## 脚本对象与两个调度器

示例 [`HelloWorld.js`](../../2.4.15NewProject/assets/Script/HelloWorld.js) 使用 `cc.Class` 声明 `cc.Component`，在 `onLoad` 中给 `cc.Label` 赋值。`cocos2d/core/platform/CCClass.js:949-1024` 从描述对象创建类；`cocos2d/core/components/CCComponent.js:627,663-665` 为组件类保存默认及配置的 `_executionOrder`。创建实例仍应走节点的 `addComponent`，而非自己 `new` 后接入生命周期。

运行时有两套相邻但不同的调度结构：

```text
Node/Component 激活
  → NodeActivator：批量 __preload、onLoad、onEnable
  → ComponentScheduler：start、update、lateUpdate 队列
  → Director.mainLoop：按帧调用 ComponentScheduler 和 Scheduler
Component.schedule / scheduleOnce
  → Director.getScheduler() → CallbackTimer
```

`cocos2d/core/node-activator.js:240-252,313-350` 对一次节点树激活先递归收集，再分批执行 `__preload → onLoad → onEnable`。`onLoad` 的登记不以组件 `enabled` 为条件；`onEnable` 则要求组件启用且节点仍在活动层级。`component-scheduler.js:73-185` 把生命周期队列分成负、零、正优先级，`onLoad/onEnable/start` 使用一次性队列，`update/lateUpdate` 使用可重复队列。负、正队列按 `_executionOrder` 排；零优先级保留加入顺序。生命周期排序适用于一次调度任务，不能把先后两次独立的激活强行解释为全局优先级排序。

`start` 以 `IsStartCalled` 标志保证最多执行一次；关闭后重新启用可再次执行 `onEnable`，但不会重跑已完成的 `onLoad/start`（`component-scheduler.js:346-372,446-462`）。`node-activator.js:354-370` 仅在已完成 `onLoad` 的组件销毁时调用 `onDestroy`，对应手册关于 `onLoad/onDestroy` 成对的约束。

`CCComponent.js:559-576,592-621` 的 `schedule` 把组件自己作为计时器目标，委托 `cc.director.getScheduler()`；它与组件 `update` 队列不是同一条注册路径。`component-scheduler.js:346-372` 在组件启用/停用时恢复或暂停该目标的计时器，并增删尚未运行的 `start` 与每帧回调。`CCScheduler.js:150-231` 的 `CallbackTimer` 首次 `update` 只把 `_elapsed` 从 `-1` 初始化为 `0`；即使延迟参数为零，也不会在这一次更新里触发回调。`CCComponent._onPreDestroy`（`:503-529`）会取消组件的所有定时器，再进入销毁回调及移除流程。

`CCScheduler.update`（`CCScheduler.js:399-414`）先按自身 `_timeScale` 缩放传入的 `dt`，而 `CCDirector.mainLoop` 把原 `deltaTime` 直接传给组件 `updatePhase`。因此改变通用 Scheduler 的 time scale 会改变组件定时器的计时速度，但不能由此认为组件 `update(dt)` 的参数也被相同缩放；这是一项源码结论，本次预览没有专门调节 time scale。

## 一帧内的路径

浏览器预览使用 `CCDirector.js:868-913` 的非编辑器主循环分支：

```text
EVENT_BEFORE_UPDATE
→ ComponentScheduler.startPhase
→ ComponentScheduler.updatePhase
→ Scheduler.update（含自定义计时器及引擎注册目标）
→ ComponentScheduler.lateUpdatePhase
→ EVENT_AFTER_UPDATE
→ cc.Object._deferredDestroy
→ EVENT_BEFORE_DRAW → 渲染 → EVENT_AFTER_DRAW
```

这个顺序说明：组件 `update` 与 `schedule` 的回调虽然都可能每帧运行，入口和相对位置不同。`CC_EDITOR` 的编辑器场景分支（`CCDirector.js:842-866`）还以 `updateAnimate` 决定是否推进通用 `Scheduler`，不应直接套用浏览器预览时序。

`component-scheduler.js:346-356,446-515` 在一帧调度期间把新启用组件放进 `_deferredComps`。在 `startPhase` 后续或 `lateUpdatePhase` 结束时，`_startForNewComps` 将它们入队并立即执行 `start`；本帧的 `update/lateUpdate` 已错过，下一帧才运行。这里的“立即”是相对本帧收尾，不代表在 `addComponent` 调用栈里执行 `start`。`onLoad/onEnable` 在已激活节点上挂载时仍走 `NodeActivator.activateComp` 并当场执行。

## 实际预览核对

2026-10-02 在 Creator 2.4.15 的 `2.4.15NewProject` Chrome 浏览器预览，控制台临时创建一棵活动节点树和三个内存组件。它们的优先级分别为 A=0、B=-10、C=10；项目与引擎文件没有修改。原始观测见[记录](../agent-foundation/traces/2.4.15-script-timing.jsonl)，验证流程见[skill 记录](../agent-foundation/skills/script-timing-validation.md)。

同一次激活内，三个组件的 `onLoad`、`onEnable`、`start`、第一次 `update`、第一次 `lateUpdate` 各自都是 B→A→C。`onEnable` 中注册的 `scheduleOnce(callback, 0)` 在下一帧运行，位于该帧组件 `update` 之后。销毁时观测到 `onDisable/onDestroy` 为 A→B→C，符合手册所说它们不受 `executionOrder` 影响；这个 A→B→C 只是本次遍历顺序，不能拿来当反向优先级规则。

第二个实验在 Spawner 的 `update` 中给活动节点添加 Target：`Target.onLoad/onEnable` 在 `Spawner.update` 返回前执行；`Spawner.lateUpdate` 后、同一帧内执行 `Target.start`；下一帧才执行 `Target.update`，随后是其零延迟计时器和 `Target.lateUpdate`。这与源码的延迟入队路径一致。

## 对游戏开发者的意义与边界

- 用 `onLoad` 建立可被其他组件 `start` 读取的初始引用；用 `start` 做第一次 `update` 前的初始化。若在 `update` 内动态添加组件，允许其 `onLoad/onEnable` 当场改变场景状态，而其每帧逻辑从下一帧开始。
- 若需要精确的脚本依赖顺序，在同一次激活范围内使用 `editor.executionOrder`，或按手册建议由控制组件显式调用；不要依靠销毁顺序、不同时间的激活顺序或计时器顺序模拟依赖。
- 排查定时器“漏跑”时分别检查组件/父节点启用状态、`pauseTarget`、是否已 `unschedule`、首次计时器更新的 `_elapsed=-1` 初始化，以及 Director 是否推进通用 Scheduler。浏览器的 `setTimeout` 不属于组件计时器机制。

本次验证只覆盖编辑器 Chrome 预览中临时内存组件。它没有验证编辑器属性检查器排序操作、Web 构建版、小游戏、原生平台，或某个项目脚本的资源导入与热重载；这些需要按对应环境再测。输入事件分发留到阶段 5，系统动画/物理的完整帧次序留到其专题。
