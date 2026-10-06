# 阶段 3：相同脚本行为的实现对照

先读独立研究：[2.4.15](../2.x/03-scripts-and-scheduling.md)与[3.8.7](../3.x/03-scripts-and-scheduling.md)。本篇仅比较同一开发行为；官方公开用法分别以[2.4 脚本执行顺序](https://docs.cocos.com/creator/2.4/manual/zh/scripting/execution-order.html)、[2.4 计时器](https://docs.cocos.com/creator/2.4/manual/zh/scripting/scheduler.html)、[3.8 组件执行顺序](https://docs.cocos.com/creator/3.8/manual/zh/scripting/component.html)、[3.8 计时器](https://docs.cocos.com/creator/3.8/manual/zh/scripting/scheduler.html)及各自[生命周期页（2.4）](https://docs.cocos.com/creator/2.4/manual/zh/scripting/life-cycle-callbacks.html)、[生命周期页（3.8）](https://docs.cocos.com/creator/3.8/manual/zh/scripting/life-cycle-callbacks.html)为准。

| 同一开发行为 | 2.4.15 实现 | 3.8.7 实现 | 游戏开发中的判断 |
| --- | --- | --- | --- |
| 声明并挂载脚本 | `cc.Class({extends: cc.Component})`，类元数据由 `CCClass.js` 与 `CCComponent.js` 处理；示例 `HelloWorld.js` 已挂入 `.fire` 场景。 | `class X extends Component` + `@ccclass`；装饰器元数据在 `core/data/decorators`，示例原本无脚本。 | 两版都让 Node 创建/持有 Component；类声明、导入和场景序列化格式各自独立。 |
| 首次激活 | 各次激活由 `node-activator.js` 收集并分批执行 `__preload → onLoad → onEnable`。 | `scene-graph/node-activator.ts` 采用同类批处理，内部访问受保护生命周期有 `internal*` getter。 | `onLoad` 与 `onEnable` 不是同一条件：组件关闭时仍可首次 `onLoad`，启用后才 `onEnable`。 |
| 指定生命周期优先级 | `editor.executionOrder` 写入 `_executionOrder`；`component-scheduler.js` 分负、零、正队列。 | `@executionOrder` 写入类元数据；`component-scheduler.ts` 同样分队列。 | 优先级作用于同一轮的 `onLoad/onEnable/start/update/lateUpdate`，不控制 `onDisable/onDestroy`，也不跨独立激活任务。 |
| 每帧组件回调与计时器 | `CCDirector.mainLoop` 依次调用组件 `start → update`、通用 `CCScheduler.update`、组件 `lateUpdate`。 | `Director.tick` 依次调用组件 `start → update`、已注册 `System.update`、组件 `lateUpdate`；`Scheduler` 是优先级 200 的 System。 | 两版实测零延迟计时器均处于组件 `update` 之后、`lateUpdate` 之前。3.x 与其他 System 的相对位置要再看注册优先级。 |
| 帧中新增组件 | `ComponentScheduler._deferredComps` 延迟登记；`_startForNewComps` 在本帧收尾运行 `start`。 | 同名队列和函数，效果相同。 | 两版实测 `onLoad/onEnable` 在挂载调用栈中，`start` 在本帧末，首次 `update` 在下一帧。 |
| 关闭与销毁 | 关闭时停用生命周期队列并暂停 `Scheduler` 目标；`_onPreDestroy` 取消组件定时器。 | 相同职责分在 `ComponentScheduler`、`Component` 和系统化 `Scheduler`。 | 查漏跑回调时先分辨组件启用、节点活动、定时器暂停和销毁状态。 |

## 同一场景的观测

在两个版本的编辑器 Chrome 预览中，内存创建三个跨节点组件 A(0)、B(-10)、C(10)，同时激活。两版的五组主回调各自为 **B→A→C**；`onEnable` 注册的 `scheduleOnce(...,0)` 在下一帧组件更新后执行；销毁的 `onDisable/onDestroy` 为 A→B→C。原始分帧记录分别在[2.x](../agent-foundation/traces/2.4.15-script-timing.jsonl)、[3.x](../agent-foundation/traces/3.8.7-script-timing.jsonl)。销毁顺序只说明本次遍历结果，官网明确不将它纳入 `executionOrder` 规则。

另在两版 Spawner 的 `update` 中动态创建 Target。观测到 Target `onLoad/onEnable` 同步发生，本帧 Spawner 的 `lateUpdate` 后 Target 执行 `start`，下一帧 Target 才 `update → timer0 → lateUpdate`。这个看似“`start` 与首次 `update` 不同帧”的情况，两份源码里的 `_deferredComps` 都能解释。

## 证据边界与后续

这次同一行为比较有手册、源码和浏览器预览三层证据；帧编号只用于同次预览内排序，不是跨机器的性能指标。编辑器手动调整同节点组件顺序、项目脚本资源编译/热更新、Web 发布构建、小游戏和原生平台仍未运行验证。3.x 系统列表与 2.x 直接调度的结构差别已经确认，但各动画/物理系统的具体顺序要在其专题追踪，不能由本阶段泛化。

本阶段产出两个版本专属候选 skill：[2.x](../agent-foundation/skills/cocos2-script-timing-trace/SKILL.md)、[3.x](../agent-foundation/skills/cocos3-script-timing-trace/SKILL.md)；试用案例见[验证记录](../agent-foundation/skills/script-timing-validation.md)。
