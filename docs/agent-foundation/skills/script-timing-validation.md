# 阶段 3 脚本时序 skill 验证

对应 `cocos2-script-timing-trace` 与 `cocos3-script-timing-trace`。2026-10-02 在对应 Creator 2.4.15 / 3.8.7 编辑器的 Chrome 浏览器预览中，通过 DevTools 控制台执行已审查的临时脚本；在运行时内存中创建节点和组件，销毁测试节点后读取日志。没有修改两套引擎或示例的源文件。记录中的 `f` 是各自页面的 `director._totalFrames`，只用于同一页面内比较先后；两版帧数不能互相比较。JSONL 是从控制台分段输出转录的事件序列：[2.x](../traces/2.4.15-script-timing.jsonl)、[3.x](../traces/3.8.7-script-timing.jsonl)。

| skill 试用任务 | 路由及源码定位 | 预览观测 | 判断 |
| --- | --- | --- | --- |
| 2.x：跨节点组件配置 -10/0/10 后，五个主回调与计时器究竟怎么排？ | 2.4 手册 `editor.executionOrder` → `NodeActivator` 批处理 → `ComponentScheduler` 三组优先级队列 → `CCDirector.mainLoop` / `CCScheduler`。 | `onLoad/onEnable/start/update/lateUpdate` 各为 B(-10)→A(0)→C(10)；`onEnable` 中 `scheduleOnce(...,0)` 下一帧触发。 | 正常案例通过；计时器不是组件 `update` 队列。 |
| 2.x：在某组件的 `update` 中新增组件，为什么它 `onLoad` 立即发生，但当帧没有 `update`？ | `BaseNode.addComponent` → `NodeActivator.activateComp`；`ComponentScheduler._deferredComps` → `_startForNewComps`。 | Target `onLoad/onEnable` 在 Spawner 的 `update` 调用中，`start` 在本帧 Spawner `lateUpdate` 后，首次 `update` 下一帧。 | 易混淆案例通过；skill 明确区分同步激活与延迟入每帧队列。 |
| 3.x：`@executionOrder` 为何不能控制销毁回调？ | 3.8 手册限定五个回调；装饰器元数据进入 `_executionOrder`，`ComponentScheduler` 排主回调，销毁走 `NodeActivator.destroyComp`。 | B→A→C 只出现在五个主回调；`onDisable/onDestroy` 实测 A→B→C。 | 正常及反例通过；不能把 A→B→C 推广成销毁规则。 |
| 3.x：在 `update` 动态添加组件时，零延迟计时器、`start`、首次 `update` 的帧位？ | `ComponentScheduler._deferredComps`；`Director.tick` 中系统阶段；`CallbackTimer._elapsed=-1` 首次更新。 | Target `start` 在当前帧末；下一帧 `update → timer0 → lateUpdate`。 | 易混淆案例通过；skill 要求看实际 System 优先级和平台。 |

两版[生命周期手册（2.4）](https://docs.cocos.com/creator/2.4/manual/zh/scripting/life-cycle-callbacks.html)、[3.8](https://docs.cocos.com/creator/3.8/manual/zh/scripting/life-cycle-callbacks.html)与首次激活、`start` 先于 `update` 的观测一致；[执行顺序手册（2.4）](https://docs.cocos.com/creator/2.4/manual/zh/scripting/execution-order.html)、[3.8](https://docs.cocos.com/creator/3.8/manual/zh/scripting/component.html)与优先级及 `onDisable/onDestroy` 边界一致。[计时器手册（2.4）](https://docs.cocos.com/creator/2.4/manual/zh/scripting/scheduler.html)、[3.8](https://docs.cocos.com/creator/3.8/manual/zh/scripting/scheduler.html)说明公开用法，但不保证本次测得的零延迟帧位；该结论仅归于当前源码与预览。

原引擎仓库未为本次阶段安装完整依赖，未运行它们的全套测试。编辑器内属性检查器调整组件顺序、项目脚本编译/热重载、Web 发布包、小游戏和原生运行时没有在本轮测量；skill 指示遇到这些环境时重新取证。
