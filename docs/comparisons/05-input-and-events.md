# 同一输入与事件行为：2.4.15 与 3.8.7

先分别阅读[2.x 研究](../2.x/05-input-and-events.md)和[3.x 研究](../3.x/05-input-and-events.md)。公开行为按各自[2.4 事件手册](https://docs.cocos.com/creator/2.4/manual/zh/scripting/events.html)、[2.4 节点事件](https://docs.cocos.com/creator/2.4/manual/zh/scripting/internal-events.html)、[2.4 全局输入](https://docs.cocos.com/creator/2.4/manual/zh/scripting/player-controls.html)，以及[3.8 事件手册](https://docs.cocos.com/creator/3.8/manual/zh/engine/event/event-emit.html)、[输入事件](https://docs.cocos.com/creator/3.8/manual/zh/engine/event/event-input.html)、[节点事件](https://docs.cocos.com/creator/3.8/manual/zh/engine/event/event-node.html)为准。两版 Web 输入链均已在各自示例预览中实测，Native/小游戏入口仅有源码证据。

| 游戏开发问题 | 2.4.15 | 3.8.7 | 对架构理解的影响 |
| --- | --- | --- | --- |
| 从哪里监听全局输入？ | `cc.systemEvent` 提供键盘和重力传感器。鼠标/触摸按官方手册应使用 `node.on`。 | 推荐 `input` 统一监听全局鼠标/触摸/键盘/加速度计等；`systemEvent` 从 3.4 起弃用，作为兼容桥仍存在。 | 不要看到同名“system event”就把 API 映射成同一接口。版本、全局或节点作用域、回调参数都要明确。 |
| 谁接收节点点击？ | 输入经 `CCInputManager` 与 `CCEventManager`，Node 首次注册时挂 one-by-one listener；`CCNode._hitTest` 按相机、世界矩阵、尺寸和 Mask 判断。 | PAL input source 统一发 `EventMouse/EventTouch`；`PointerEventDispatcher` 遍历注册了 pointer listener 的 `NodeEventProcessor`，由其用 `UITransform.hitTest` 检查 UI 节点。 | 两版都不是为每个 Node 绑一条 DOM listener；它们有引擎自己的输入源与节点命中分发层。3.8 明确将 3D 物体拾取留给全局 input + Camera Raycast。 |
| 重叠的 UI 如何吞噬？ | 静态路径由 `CCEventManager` 场景图优先级和 `swallowTouches=true` 拦截低优先级触摸。2.4.15 预览实测：顶层吞噬触摸，但鼠标按下事件仍到达两个重叠 Node。 | Pointer dispatcher 按 Camera priority 与 sibling 层级排序；NodeEventProcessor 按 Touch ID 认领，默认吞噬。3.8.7 预览实测：顶层拦截触摸和鼠标输入，底层 Node 均未收到。 | 相同视觉遮挡下，两版鼠标 Node 分发不同；触摸 sibling 吞噬与父子冒泡仍是两段规则。结论限定于这两次 Web 预览配置。 |
| 输入坐标是节点局部坐标吗？ | Web 探针样本中 `getLocation()`=(479.5,321)，`getLocationInView()`=(479.5,319)，设计分辨率 960×640，纵坐标呈相反原点。节点命中再用 Camera/世界矩阵求局部点。 | 3.8.7 预览设计分辨率 960×640、窗口 1920×1280 时，探针 `getLocation()`=(959,641)，`getUILocation()`=(479.5,320.5)；UI 命中由 `UITransform` 按相机窗口测试。3D 需按屏幕点构造 Ray。 | 不要仅凭两个版本坐标方法名称判断同一空间；记录真实返回值及缩放后，再转换到目标节点或世界坐标。 |
| 父组件能否先截获？ | 节点输入支持祖先捕获、目标、祖先冒泡；`useCapture` 选择捕获监听器。 | Node processor 将捕获/冒泡回调分别存放，触摸与鼠标事件按捕获→目标→冒泡执行。 | 同一 Node 上监听器、跨父子节点传播、跨遮挡节点吞噬是三类先后关系，分开描述和测量。 |
| `emit` 会冒泡吗？ | `Node.emit` 只调用当前 Node；`dispatchEvent(new cc.Event.EventCustom(type,true))` 让事件沿 Node 树传递，但普通自定义类型的 `useCapture` 被 `CCNode.on` 忽略，实测顺序为目标→父→祖父。 | `EventTarget.emit` 只在目标内；冒泡 `dispatchEvent` 实测父捕获→目标→父冒泡。 | 两版的“可冒泡”不能推导为相同的自定义事件捕获行为；2.4 的输入事件捕获与其普通自定义事件注册分支不同。 |
| 如何让重叠节点都收到输入？ | 底层 one-by-one touch listener 的 `swallowTouches=false` 实测使两个 sibling 都收到触摸，但此次设置依赖内部 `_touchListener`，不是 2.4 手册公开方案。鼠标本来就到达两者。 | 顶层回调设置官方 `event.preventSwallow=true`，实测底层收到 `touch-start` 和 `mouse-down`；未设置结束事件穿透时，`touch-end` 只到顶层。 | 区分公开可用 API 与用于理解实现的内部开关；是否穿透须按事件类型和触点认领阶段测试。 |
| UI 与全局输入谁先回调？ | `cc.systemEvent` 的键盘输入不依赖 Node 命中；浏览器预览聚焦 Canvas 后按 `a` 实测 `KEY_DOWN` 键码 65。2.4 没有 3.8 的统一全局 `input` 门面。 | UI 命中时，Node 先处理并阻止 GLOBAL dispatcher，穿透到 sibling 仍未到全局。停用 UI 后，实测兼容 `systemEvent` 在当前注册顺序下先于直接 `input` 监听器收到同类全局事件；兼容 touch 回调是 `(touch,event)`。 | `systemEvent` 与 `input` 同属 3.8 GLOBAL 层，不意味着全局一定收到被 UI 处理的指针事件；监听器注册顺序影响同层回调先后。 |
| 原生事件何时进脚本？ | JSB 和 Web 的平台监听注册不同；本篇只完成 Web 输入源静态追踪。 | Native PAL 注册 `jsb.onTouch*`，输入消息暂存并在 `Director.tick` 的 `input._frameDispatchEvents` 派发；Web 的若干事件可立即派发。 | 不能从 Web 回调时间推断 Native。3.x 有输入帧缓冲，需按平台与事件类别标记测量时点。 |

## 版本专属结论

2.4 的开发者可见入口很清楚地分为“节点鼠标/触摸”与“全局键盘/重力”。底层 `CCEventManager` 同时承担平台事件路由、场景图排序、触点声明和吞噬，因此手册不推荐从脚本直接操作它。此处 2.4.15 Web 实测中，触摸 sibling 吞噬与鼠标 Node 分发不是同一行为。

3.8 的 `input` 是面向全局输入的统一门面，但 UI 节点触摸仍走独立的 `PointerEventDispatcher` 与 `NodeEventProcessor`。3.8 `systemEvent` 是基于 input 的兼容桥；官方输入手册区分两者历史行为，并说明 v3.4.1 后两种全局 API 的优先级差异已消失。这个说法不表示 UI Node 命中层也消失：源码显式保留 `UI` 与 `GLOBAL` dispatcher 层级。

两版内置 Node 指针事件都能表现捕获/目标/冒泡，内部监听结构不同：2.4 用 `CCEventManager` 内 `EventListener` 与 Node 上的 EventTarget 回调表；3.8 将 Node 事件收进 `NodeEventProcessor`，并由 2D 指针 dispatcher 独立维护可命中处理器列表。普通自定义事件的捕获行为则如上表不同；两版 `emit` 都不会自动沿节点树传播。

## 实测与证据边界

首轮真实浏览器探针轨迹见 [2.4.15](../agent-foundation/traces/2.4.15-input-events.jsonl) 与 [3.8.7](../agent-foundation/traces/3.8.7-input-events.jsonl)，[2.4.15 收口](../agent-foundation/traces/2.4.15-input-events-completion.jsonl)与[3.8.7 收口](../agent-foundation/traces/3.8.7-input-events-completion.jsonl)补足穿透、自定义事件及全局输入。共同观察到节点输入的捕获→目标→冒泡、触点认领后继续接收 move、出界后 cancel；两版鼠标在重叠 Node 上的派发行为不同，自定义事件捕获也不同。坐标与顺序结果限定于对应预览。详见[验证记录](../agent-foundation/skills/input-event-validation.md)。3D Raycast、Native 和小游戏仍属后续专题。
