# 2.4.15 输入与事件系统

本篇以 [2.4 事件监听与发射](https://docs.cocos.com/creator/2.4/manual/zh/scripting/events.html)、[节点系统事件](https://docs.cocos.com/creator/2.4/manual/zh/scripting/internal-events.html)和[全局系统事件](https://docs.cocos.com/creator/2.4/manual/zh/scripting/player-controls.html)为公开行为基线。手册要求游戏脚本通过 `Node.on/off` 接收节点鼠标/触摸，通过 `cc.systemEvent` 接收键盘和重力传感器事件；明确不建议将 `cc.eventManager` 当作游戏层公开入口。另在 Creator 2.4.15 Hello World 浏览器预览中通过 DevTools 临时内存节点捕获了鼠标/触摸命中、传播和坐标轨迹；尚未验证 Native/小游戏平台。

## 公开入口先分三类

| 游戏开发行为 | 2.4.15 公开入口 | 依据 |
| --- | --- | --- |
| 监听节点鼠标/触摸 | `node.on(cc.Node.EventType..., callback, target)`，结束时匹配参数调用 `off` | 节点事件在目标节点命中后进入捕获、目标、冒泡阶段；可用 `stopPropagation` 中断。 |
| 监听键盘/重力感应 | `cc.systemEvent.on/off`；加速度计另启用 `setAccelerometerEnabled(true)` | 全局事件独立于节点树；2.4 手册将鼠标/触摸归入节点系统事件。 |
| 发送游戏自定义通知 | `node.emit(type, ...args)` 或 `dispatchEvent(event)` | `emit` 只调同一目标上的监听器；`dispatchEvent` 面向节点传播事件流。 |

`cc.eventManager` 是底层事件分发器，不是推荐的脚本入口。手册提到最多五个 `emit` 参数；节点输入事件则包含 `EventTouch`/`EventMouse` 信息，不应把平台 DOM 事件对象当成引擎回调参数。

## Web 鼠标/触摸路径

```text
Creator Web 宿主启动
  → CCGame._runMainLoop / registerSystemEvent(canvas)
  → CCInputManager 读取浏览器事件，换算至 View 设计坐标并建立 Touch/Event
  → eventManager.dispatchEvent(EventTouch/EventMouse)
  → scene-graph 优先级的 Node EventListener
  → CCNode 命中测试
  → node.dispatchEvent
  → 父节点捕获监听 → 目标监听 → 父节点冒泡监听
  → Component 注册的回调
```

### 从页面输入到统一分发

- `cocos2d/core/CCGame.js::run`/游戏启动流程调用 `cc.internal.inputManager.registerSystemEvent(canvas)`。2.4 的 Web `CCInputManager.js::registerSystemEvent` 绑定窗口/Canvas 上的鼠标、触摸事件；它把浏览器坐标交给 `cc.view.convertToLocationInView`，再转换 Touch、Mouse 或 Keyboard 对象。触摸开始/移动/结束/取消分别进入 `handleTouchesBegin/Move/End/Cancel`，最后以 `cc.Event.EventTouch` 交给 `eventManager.dispatchEvent`。
- `CCInputManager.handleTouchesBegin` 将平台触点按 ID 放入复用触点表，并经 `cc.view._convertTouchesWithScale` 换算后一次发出多点 `EventTouch`；结束/取消时先清理触点映射再派发结束事件。鼠标在桌面浏览器也可映射成单触点，相关开关与设备兼容分支应从 `registerSystemEvent` 的实际平台条件判断。
- `CCEventManager.dispatchEvent` 先看全局分发器是否启用；触摸事件走 `_dispatchTouchEvent`，非触摸事件按事件类型选监听表。触摸回调遍历每个触点，再将监听器按固定优先级、节点树优先级依序调用。节点输入监听器以 scene-graph priority 注册，并配置 `TOUCH_ONE_BY_ONE` 与 `swallowTouches=true`；返回已处理会声明触点并阻断较低优先级监听器。多点触摸默认开启，`cc.macro.ENABLE_MULTI_TOUCH=false` 时全局只保留当前活动触点。

### 命中与节点事件传播

- `CCNode._checknSetupSysEvent` 首次对节点注册鼠标/触摸时才创建底层 `EventListener`；`CCNode.on/off` 的 Node API 管理回调，底层事件监听器负责让 Node 有资格接收输入。对未激活节点会暂停事件目标；停用/销毁节点时事件管理器同步暂停或删除监听器。
- 节点触摸起始回调 `_touchStartHandler` 仅在 `node._hitTest` 命中时接受并声明触点。`_hitTest` 把屏幕/设计坐标经 Camera（若存在）、节点世界矩阵逆变换和锚点变换转为节点局部坐标，再检查 `contentSize` 矩形；若监听器携带 Mask，还会逐层检查祖先 Mask。触点一经认领，MOVE 会继续送给该监听器；结束点仍在区域内产生 `TOUCH_END`，离开区域则转成 `TOUCH_CANCEL`。
- 鼠标监听器执行同样的节点命中判断；移动时比较上次命中状态，产生 `MOUSE_ENTER/LEAVE/MOVE`。兄弟节点之间的拦截由 EventManager scene-graph 优先级和 listener swallow 决定；这与同一节点的父子冒泡不同。
- `CCNode.dispatchEvent` 调用节点自己的事件流实现：按祖先链计算捕获目标，依次运行祖先捕获、目标捕获和目标普通监听器、再运行可冒泡的祖先监听器。`event.stopPropagation()` 阻止后续节点，`stopPropagationImmediate()` 还停止当前节点后续监听器。`Node.emit` 只经当前 Node 的普通监听器触发自定义事件，不自动冒泡。

## 浏览器预览探针结果

在 `2.4.15NewProject` 的 Creator 浏览器预览中，由 DevTools 临时创建父节点及两个重叠子节点，注册父捕获/冒泡与子节点触摸/鼠标监听；只对浏览器实际执行中心点击和拖出操作。完整转录见[2.4.15 输入轨迹](../agent-foundation/traces/2.4.15-input-events.jsonl)。探针未修改脚本、场景或引擎文件。

- 触摸开始顺序为父捕获 → 最上层子节点 → 父冒泡；底层重叠子节点未收到该次触摸开始。这验证了“触点被上层目标认领/吞噬”与“父节点仍可收到冒泡”可以同时成立。
- 对同一区域执行浏览器鼠标按下时，两个重叠节点均收到 mouse down，各自都经过父捕获和冒泡。此预览结果不能简化为触摸的 one-by-one 吞噬规则。
- 触摸从命中区域拖出后，原目标继续收到 touch move；本次结束触发 touch cancel，父捕获、目标、父冒泡顺序仍可观察。
- 设计分辨率 960×640 中，`getLocation()` 示例为 (479.5, 321)，`getLocationInView()` 为 (479.5, 319)，两者纵坐标和为 640，体现相反的垂直原点。该结论限定于这次 2.4.15 Web 预览和点击位置。

补测见[阶段 5 收口轨迹](../agent-foundation/traces/2.4.15-input-events-completion.jsonl)：将顶层节点自动创建的 `_touchListener.swallowTouches` 临时设为 `false` 后，实际一次浏览器点击依次产生顶层、底层的 `touchstart` 和 `touchend`；鼠标按下仍到达两个节点。`_touchListener` 是内部字段，手册没有将其列为普通项目脚本的穿透 API；诊断时可据此理解底层行为，不应把它写成稳定公开接口。Canvas 获得焦点后按 `a`，`cc.systemEvent` 收到 `KEY_DOWN`，键码 65。

以上是特定编辑器预览、Canvas/摄像机配置和浏览器输入下的实测；不能据此推广至 JSB 或其他 Web 视图配置。

## 键盘与重力感应

`cocos2d/core/event/system-event.js::SystemEvent` 继承通用 `EventTarget`。首次注册键盘事件时它添加一个全局 `CCEventManager` Keyboard listener，回调将 `cc.Event.EventKeyboard` 转派给 `cc.systemEvent`；最后一个键盘监听器注销后底层 listener 会被移除。重力传感器通过 `CCInputManager.setAccelerometerEnabled` 建立平台监听并经调度器按间隔派发 `EventAcceleration`；Web 使用设备运动/方向事件，JSB 路径调用 `jsb.device`。

## 自定义事件与监听器生命周期

`core/event/event-target.js::EventTarget` 是回调表能力。`on` 去重并记住带 `__eventTargets` 的 target；`once` 在首次调用后移除；`off(type, callback, target)` 要与注册参数匹配；`targetOff(target)` 移除此 target 在当前 EventTarget 上注册的项。Component 销毁清理其 `__eventTargets`，但解绑全局单例的时机仍应按游戏状态需要在 `onDisable` 或 `onDestroy` 主动选择，不要依赖节点系统事件暂停会替用户解绑 `cc.systemEvent`。

`emit` 走 `CallbacksInvoker` 同步调用同一对象的监听器。Node 的 `dispatchEvent(new cc.Event.EventCustom(type, true))` 才会按节点树传递。这里有一处必须区分输入与自定义事件：`CCNode.on` 只有在 `_checknSetupSysEvent(type)` 判定为内置触摸/鼠标类型时才转入 `_onDispatch` 并使用 `useCapture`；普通自定义类型总是注册到 `_bubblingListeners`，即使传入第四个参数 `true`。浏览器探针实际得到 `emit` 仅子节点、`dispatchEvent` 子→父→祖父（父/祖父上标记为 capture 的回调也在冒泡阶段调用），父节点 `stopPropagation()` 则阻止祖父回调。2.4 手册以 `EventCustom`、`stopPropagation()` 描述此公开用法。自定义通知无需传播时直接使用 `emit`。

## 证据索引与边界

| 主题 | 2.4.15 源码位置 |
| --- | --- |
| 入口注册 Web 事件 | `cocos2d/core/CCGame.js::run`、`cocos2d/core/platform/CCInputManager.js::registerSystemEvent` |
| 触摸与鼠标对象化、坐标处理 | `cocos2d/core/platform/CCInputManager.js::handleTouchesBegin/Move/End/Cancel` 及鼠标处理函数、`cocos2d/core/platform/CCInputExtension.js` |
| 事件优先级、认领/吞噬 | `cocos2d/core/event-manager/CCEventManager.js::dispatchEvent/_dispatchTouchEvent/_onTouchEventCallback/_dispatchEventToListeners` |
| 节点监听器和命中测试 | `cocos2d/core/CCNode.js::_checknSetupSysEvent/_touchStartHandler/_hitTest` |
| 捕获、目标、冒泡 | `cocos2d/core/CCNode.js::on/_onDispatch/dispatchEvent/_getCapturingTargets/_getBubblingTargets` |
| 全局键盘/加速计事件 | `cocos2d/core/event/system-event.js`、`cocos2d/core/platform/CCInputExtension.js` |
| 通用事件回调表 | `cocos2d/core/event/event-target.js`、`cocos2d/core/platform/callbacks-invoker.js` |

这条 Web 路径不代表原生 JSB 与每个小游戏平台的原生事件桥。2.4 仓库的原生绑定和平台文件分布不同；本篇没有观测 Android/iOS 输入，也没有声称 Web DOM 监听顺序等同原生回调时序。
