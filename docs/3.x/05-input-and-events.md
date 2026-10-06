# 3.8.7 输入与事件系统

本篇以 [3.8 事件发射与监听](https://docs.cocos.com/creator/3.8/manual/zh/engine/event/event-emit.html)、[输入事件系统](https://docs.cocos.com/creator/3.8/manual/zh/engine/event/event-input.html)、[节点事件系统](https://docs.cocos.com/creator/3.8/manual/zh/engine/event/event-node.html)和[屏幕事件系统](https://docs.cocos.com/creator/3.8/manual/zh/engine/event/event-screen.html)为开发者行为基线。3.8 手册建议全局硬件输入使用 `input`，`systemEvent` 自 v3.4.0 起弃用；UI 节点指针事件经 `Node.on` 命中并传播。本文以仓库 3.8.7 TypeScript/PAL 源码追踪入口，并在示例浏览器预览中以临时内存 UI 节点实测点击传播、重叠目标拦截、屏幕/UI 坐标和移出节点后的取消分支。

## 先区分三种公开事件接口

| 游戏开发行为 | 3.8.7 入口 | 实际角色 |
| --- | --- | --- |
| 全局键盘、鼠标、触摸、加速度计等硬件输入 | `input.on(Input.EventType..., callback, target)` | 一个 `EventTarget` 风格的全局输入门面，屏幕坐标可通过 `getLocation()` 读取；用于 3D 拾取时按官方示例转为 Camera ray 并做物理射线检测。 |
| UI 节点输入和节点自定义事件 | `node.on(Node.EventType..., callback, target[, useCapture])` | UI 指针分发器做 `UITransform.hitTest` 后，节点事件处理器负责捕获/目标/冒泡；普通 `node.emit` 只触发本节点的自定义事件。 |
| 兼容旧代码的全局输入 API | `systemEvent` | 已弃用的兼容封装；内部将 `input` 事件转发到旧 `SystemEventType`，触摸回调签名与 `input` 不同。新代码使用 `input`。 |

## 输入从平台进入 TypeScript

```text
PAL Web / native / mini-game InputSource
  → cocos/input/Input 将原生消息适配为 EventTouch/EventMouse/EventKeyboard
  → input._emitEvent 按 dispatcher priority 派发
      → PointerEventDispatcher (UI): UITransform 命中、触点认领、Node.dispatchEvent
      → InputEventDispatcher (GLOBAL): input EventTarget 上的全局监听器
  → Director.tick 的 _frameDispatchEvents 处理被缓存的输入类型
  → Component 回调
```

- `pal/input/web/touch-input.ts::TouchInputSource` 在 `GameCanvas` 上监听浏览器 `touchstart/move/end/cancel`，根据 Canvas rect、frame rotation 和 `screenAdapter.devicePixelRatio` 生成引擎触点；阻止浏览器继续传播，命中 Canvas 本身时阻止默认行为。`mouse-input.ts` 在 Web 监听 Canvas/Window，换算 MouseEvent 坐标并构造 `EventMouse`。PAL 还有独立 native 和 mini-game 实现，不要把 DOM 细节写成所有平台共有条件。
- `cocos/input/input.ts::Input._registerEvent` 将各 PAL source 的消息接入输入事件类型。桌面鼠标按下/移动/松开还会合成触摸事件（ID 0），用于点击/拖拽时同时支持 UI 触摸监听。触摸批次在 `_dispatchEventTouch` 中按每个 Touch 分派，并重置该次传播标志。
- `Input._emitEvent` 按 `_eventDispatcherList` 的优先级同步调用 dispatcher，某 dispatcher 返回 `false` 时停止后续 dispatcher。通用全局入口由 `InputEventDispatcher` 转成 `_eventTarget.emit(type,event)`；UI 节点入口由 `cocos/2d/event/pointer-event-dispatcher.ts::PointerEventDispatcher` 实现。
- 当前源码中的 `EventDispatcherPriority` 明确令 `UI=1`、`GLOBAL=0`，`_registerEventDispatcher` 降序排序；UI dispatcher 命中后会阻止后续全局 dispatcher。手册称从 v3.4.1 起 `input` 与兼容 API `systemEvent` 的优先级差异消失；源码也把 `systemEvent` 桥接到同一个全局 Input EventTarget，因此二者同属 `GLOBAL` 层。这里要区分两种比较：`input` 与 `systemEvent` 在全局层相同；UI Node dispatcher 相对全局输入仍有单独的 `UI` 层级。
- Native PAL `pal/input/native/touch-input.ts` 注册 `jsb.onTouchStart/Move/End/Cancel`，先缓存桥接触点；`Input._frameDispatchEvents` 会在 Director 帧开始派发该缓存事件。与 Web 默认可立即派发不同，`input.ts::dispatchImmediately = !NATIVE` 令原生输入归入帧循环。这个时序是源码结论，待原生触摸实测。

## UI 节点命中、顺序和传播

- 首次给 Node 注册鼠标/触摸时，`NodeEventProcessor._tryEmittingAddEvent` 将其登记到 `PointerEventDispatcher`。派发器在一次输入期间冻结增删列表，避免正在遍历时改动处理器；脏列表排序会读取 `UITransform` 的 camera priority，再结合父子与 siblingIndex 决定同层命中先后。
- `NodeEventProcessor._handleTouchStart/_handleMouseDown` 需要 Node 的 `UITransform`，用 `hitTest(location, windowId)` 命中屏幕坐标。3.8 UI 节点事件是二维界面命中；3D 世界物体点击应按手册使用 `input` 取得触点、由目标 Camera `screenPointToRay`，再用 PhysicsSystem 射线检测。
- Touch start 命中后，处理器认领 Touch ID。后续 move/end/cancel 由原处理器接收，即使手指已移出矩形；end 根据结束时命中结果改成 `TOUCH_END` 或 `TOUCH_CANCEL`。节点销毁且仍在跟踪的触点会补发 cancel。重叠节点的吞噬由 `preventSwallow` 控制；`Button`、`Toggle` 与 `BlockInputEvents` 会在节点层阻止向下层穿透。穿透涉及更多 hit-test，手册也提醒这会降低派发效率。
- `NodeEventProcessor.dispatchEvent` 先沿祖先链运行捕获监听，再在目标节点运行捕获与普通监听，最后按冒泡顺序调用父节点监听；`event.bubbles` 决定是否继续冒泡，`propagationStopped` 中断后续节点，`propagationImmediateStopped` 还中断目标节点后续监听。`EventTarget.emit` 是同目标的轻量通知，不等同于节点树事件传播。

## 浏览器预览探针结果

在 `3.8,7NewProject` 的 Creator 3.8.7 浏览器预览中，用 DevTools 临时创建 Canvas、UITransform 父子节点和正交 UI 相机，并对重叠目标注册 Node 输入监听。探针对象只存在于页面内存，输入由真实浏览器鼠标点击和拖动产生。详细记录见[3.8.7 输入轨迹](../agent-foundation/traces/3.8.7-input-events.jsonl)。

- 点击重叠区域时，触摸回调顺序为父捕获 → 上层目标 → 父冒泡；桌面浏览器还合成触摸 ID 0。鼠标按下同样只到上层目标，父节点仍收到捕获和冒泡；下层兄弟没有收到这些事件。
- 从上层目标拖到其 UITransform 命中区域外后，原目标仍收到 `touch-move`；结束时事件改为 `touch-cancel`，并继续按父捕获 → 原目标 → 父冒泡传播。目标外的 `mouse-up` 没有到达子节点。
- 本次屏幕窗口为 1920×1280，游戏设计分辨率 960×640；中心输入的 `getLocation()` 为 (959,641)，`getUILocation()` 为 (479.5,320.5)。这次预览的窗口/设计坐标比例为 2:1，不应推广至其他适配设置。
- 原 3D 示例没有 UI Canvas。探针创建了临时 Canvas 和 UI 相机；期间将场景 Main Camera 可见层临时缩为 DEFAULT，避免它额外命中 UI_2D。页面重载会恢复该运行时改动。此轨迹不证明示例模型能接收 Node 点击，也没有测试 3D Raycast。

追加的[阶段 5 收口轨迹](../agent-foundation/traces/3.8.7-input-events-completion.jsonl)实测了穿透、全局入口和自定义事件。上层 `touch-start`/`mouse-down` 回调设置 `event.preventSwallow=true` 后，底层重叠节点也收到这两种开始事件；未为 `touch-end` 设置穿透时，结束事件只到上层。UI 命中且穿透到兄弟节点的这一轮，全局 `input`/`systemEvent` 仍未收到开始事件，因为 UI dispatcher 已处理输入。停用两层 UI 后，同一 Canvas 点击的回调是 `systemEvent.TOUCH_START` → `input.TOUCH_START` → `systemEvent.MOUSE_DOWN` → `input.MOUSE_DOWN`；兼容触摸回调收到 `(touch,event)` 两个参数，`input` 收到单个事件。本轮先后顺序来自当前 `systemEvent` 在初始化时预先向 `input` 注册桥接回调的实现和这次注册顺序，不应宣称所有用户监听顺序固定。自定义 `emit` 只到目标；冒泡 `dispatchEvent` 依次触发父捕获、目标、父冒泡。以上均为桌面 Web，未测试原生/小游戏输入桥。
- 全局 `input` 和 node event 的坐标 API 不同任务可见：官方输入手册明确全局 `EventTouch.getLocation()` 是屏幕空间，`getUILocation()` 是 UI 空间；3D 射线用 screen location，UI 自定义坐标应按 Canvas/UI 转换规则核对。不要将事件位置直接当作 Node localPosition。

## 通用 EventTarget 与系统事件

`cocos/core/event/event-target.ts` 通过 `Eventify` 组合通用事件目标能力；底层 `callbacks-invoker.ts` 管理多类型监听回调。`on/once/off/targetOff` 处理注册、单次调用和注销，Node 自己的 `NodeEventProcessor` 将捕获/冒泡阶段存放在两张 invoker 中。Component 注册到全局 `input` 的监听必须在生命周期退出时主动 `off`，而 Node 自身销毁会清理所属 processor。官方输入样例通常在 `onDestroy` 清理全局监听；只在对象启停期间有效时可配对 `onEnable/onDisable`。

3.8 `cocos/input/system-event.ts::SystemEvent` 是旧 API 适配器：它在构造时为 input 各类型注册桥接，再发出旧 `SystemEventType`；触摸回调使用 `(touch, event)`，而 `input` 是 `(event)`。全局键盘等监听可用 `input`；不要因为旧代码仍导出了 systemEvent 就把它当 3.8 推荐入口。

## 证据索引与边界

| 主题 | 3.8.7 源码位置 |
| --- | --- |
| 公共输入门面、调度和桌面鼠标合成 Touch | `cocos/input/input.ts::Input._registerEvent/_emitEvent/_simulateEventTouch/_frameDispatchEvents` |
| Web 输入源 | `pal/input/web/touch-input.ts`、`pal/input/web/mouse-input.ts`、`pal/screen-adapter/` |
| Native 触点桥接及帧缓存 | `pal/input/native/touch-input.ts`、`cocos/game/director.ts::tick` |
| 节点 UI 处理器队列、排序与吞噬 | `cocos/2d/event/pointer-event-dispatcher.ts::PointerEventDispatcher` |
| 命中、手势认领及传播 | `cocos/scene-graph/node-event-processor.ts::NodeEventProcessor`、`cocos/scene-graph/node.ts::dispatchEvent`、`cocos/2d/framework/ui-transform.ts::UITransform.hitTest` |
| 自定义事件与兼容系统事件 | `cocos/core/event/{event-target,eventify,callbacks-invoker}.ts`、`cocos/input/system-event.ts` |

本篇静态追踪 Web/Native PAL 的入口差异与公共 TypeScript 派发层，并用 Web 探针核实了全局兼容桥、UI/global 层级与自定义事件；未观测 Android/iOS 原生触摸、小游戏平台输入、键盘边缘条件、多窗口或 3D raycast 项目案例。后两类平台输入归阶段 10，3D 拾取归阶段 9。
