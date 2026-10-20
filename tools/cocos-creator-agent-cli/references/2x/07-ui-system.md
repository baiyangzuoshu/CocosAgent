# 2.4.15 UI 系统

本篇以 [2.4 UI 系统](https://docs.cocos.com/creator/2.4/manual/zh/ui/index.html)、[多分辨率适配](https://docs.cocos.com/creator/2.4/manual/zh/ui/multi-resolution.html)、[对齐策略](https://docs.cocos.com/creator/2.4/manual/zh/ui/widget-align.html)、[Layout](https://docs.cocos.com/creator/2.4/manual/zh/components/layout.html)、[Widget](https://docs.cocos.com/creator/2.4/manual/zh/components/widget.html)、[ScrollView](https://docs.cocos.com/creator/2.4/manual/zh/components/scrollview.html)和[动态列表](https://docs.cocos.com/creator/2.4/manual/zh/ui/list-with-data.html)为公开行为基线。源码快照是 `2.4.15engine`；`2.4.15NewProject` 的 Hello World 场景提供现成 Canvas、背景 Widget 与 Label。Button、Layout 列表通过浏览器 DevTools 临时创建，未写入工程文件。

## UI 的四层职责

| 层 | 开发者看到的对象 | 2.4.15 源码职责 |
| --- | --- | --- |
| 视图适配 | Canvas 的设计分辨率、Fit Width/Height | `CCCanvas.applySettings` 选择 `cc.ResolutionPolicy`；`CCView.setDesignResolutionSize` 计算缩放、可见区域及相机视口，发出 `design-resolution-changed`。 |
| 对齐 | Widget 的父节点/屏幕边缘约束 | `CCWidgetManager` 在 `EVENT_AFTER_UPDATE` 访问场景中的 Widget；窗口/Canvas resize 时按 `alignMode` 标脏并重排。`widget.updateAlignment()` 可要求当前帧立即算出位置。 |
| 排版与文本 | Layout 排子节点，Label 显示文字 | `CCLayout` 监听子节点的增删、尺寸、位置、锚点、活动状态，在 `EVENT_AFTER_UPDATE` 布局；`CCLabel.string` 改变时调用 `setVertsDirty`，由 assembler 重新生成文字几何。 |
| 交互与滚动 | Button、ScrollView | `CCButton` 订阅 Node 触摸/鼠标事件，完成按下→结束后发送 `clickEvents` 和节点 `click`；`CCScrollView` 在算边界前调用 Content 上的 `Layout.updateLayout()`。节点命中与传播依赖[阶段 5 输入链](05-input-and-events.md)。 |

2.4 的 Node 自身存储 `contentSize`、锚点、位置。Widget 和 Layout 直接读写这些 Node 属性。`CCCanvas` 用单例 `Canvas.instance` 代表当前活动 Canvas；`__preload` 应用适配并立即对齐 Canvas 上的 Widget。若无主相机且不是 Canvas 渲染模式，`start` 为其创建默认 Main Camera。本示例已经保存了 Main Camera；不要把默认创建分支当作本次预览实际执行。

## 从分辨率到动态列表

```text
Canvas 设计分辨率/Fit 设置
  → CCCanvas.applySettings → CCView.setDesignResolutionSize
  → 可见尺寸、视口与设计坐标变化
  → WidgetManager 在 resize 或更新阶段对齐 Canvas/子节点
  → Layout 监听子节点变化并在 AFTER_UPDATE 排列
  → Label 的顶点脏标记进入阶段 6 的 RenderFlow/assembler
  → Button 接收节点触摸 → node.emit('click', button)
```

Widget 的 `ONCE`、`ON_WINDOW_RESIZE`、`ALWAYS` 对应不同刷新时机。需要同一帧读取对齐结果时调用公开 `updateAlignment()`，动态增删列表项后需要立即读取坐标时调用 `layout.updateLayout()`；否则应等布局阶段完成。官方 ScrollView 用法由 View（可视区域）、Content、可选 ScrollBar 组成，View 通常用 Mask 裁剪，Content 的尺寸决定可滚动范围；详见[2.4 ScrollView 手册](https://docs.cocos.com/creator/2.4/manual/zh/components/scrollview.html)。

源码 `CCScrollView.js` 在捕获阶段订阅节点触摸开始、移动、结束。`_calculateBoundary()` 先更新 Content 上启用的 Layout，再用 View 与 Content 的 Node 尺寸算边界。`cancelInnerEvents=true` 时，移动距离超过 7 个 `getLocation()` 坐标单位后，首次拖动会向原触摸目标派发模拟 `TOUCH_CANCEL`；源码注明阈值尚未按 DPI 换算。嵌套 ViewGroup 会被专门识别以避免父子 ScrollView 同时处理。本地 Web 探针已测得 4 单位移动不取消、累计 14 单位移动后模拟取消；这不能外推为其他设备上的可见阈值。

拖动位移在 2.4 的 `_handleMoveLogic()` 中立即转为 ScrollView 本地轴向增量，并同步调用 `_processDeltaMove()` 更新 Content、采集速度样本和滚动事件；组件 `update(dt)` 只推进惯性/回弹自动滚动。松手时用采集到的位移与时间样本计算速度，先尝试弹性回边，否则按 `inertia`/`brake` 决定是否启动惯性。Web 探针里首次 MOVE 前 Content y=100，`scroll-began`/`scrolling` 回调读到 y=104，随后子项 `touchmove` 也读到 y=104，证实该路径在捕获期间同步移动。

滚轮走独立的 `MOUSE_WHEEL` 捕获回调，垂直方向优先于水平方向，回调中直接 `_processDeltaMove()`。系数默认 `-0.1`；Windows Firefox 为 `-0.1/3`，JSB/Runtime 为 `-7`。因此滚轮速度受源码平台分支影响，也与触摸拖动共用边界、速度采样和滚动事件逻辑的一部分；这些参数尚未在各平台实测。

`_scrollChildren()` 在有实际位移时先发一次 `scroll-began`，随后发 `scrolling`；到达边界时再发相应 `scroll-to-*`。`_dispatchEvent()` 用位掩码抑制同一轮滚动中重复的边界事件，收到 `scroll-ended` 才清空掩码。触摸 END 处理先发 `touch-up`，再计算松手后的回弹/惯性；若没有启动自动滚动且此前确实在滚动，释放逻辑发送 `scroll-ended`。自动滚动接近终点时先发 `scroll-ended-with-threshold`，最终才发 `scroll-ended`。滚轮定时检查在超时分支直接发送 `scroll-ended`，但该路径没有将 `_scrolling` 设回 false：Web 实测结束事件已发、掩码归零而 `_scrolling=true`；下一次拖动有 `scrolling` 却缺少新的 `scroll-began`，直到触摸释放逻辑重置状态。其他平台和边界/惯性事件仍待测。

事件有两种接线：`scrollEvents` 的编辑器 `EventHandler` 收到 `cc.ScrollView.EventType` 的数字枚举（如 `SCROLL_BEGAN=12`）；代码监听节点则用 `node.on('scroll-began', callback)` 这样的字符串。`_dispatchEvent()` 同时调用 `EventHandler.emitEvents()` 与 `node.emit()`，不要把数字枚举直接当成 Node 事件名。

运行时 `CCWidgetManager.init` 监听 `EVENT_AFTER_UPDATE`、`cc.view` 的 `canvas-resize` 和浏览器方向变化；只在编辑器分支直接监听 `cc.engine` 的 `design-resolution-changed`。因此直接调用 `cc.view.setDesignResolutionSize()` 后，不能仅凭该事件断言所有 `ON_WINDOW_RESIZE` Widget 已重新对齐；应检查是否伴随 Canvas resize，或显式调用目标 Widget 的 `updateAlignment()`。`CCLayout.updateLayout()` 还要求 `_layoutDirty` 且至少有一个活动子节点，空列表或全部失活时会跳过 `_doLayout()`。本轮实测清空后 `ResizeMode.CONTAINER` 保留旧尺寸 300×266，调用 `updateLayout()` 后仍标脏；它不会自动归零。

## Hello World Web 预览观察

在 Creator 2.4.15 的 `http://localhost:7456/` 预览中，原场景 Canvas 的设计尺寸和 Node 尺寸均为 960×640，位置为 (480,320)，`fitWidth=false`、`fitHeight=true`；背景 Widget 上下左右距离均为 0，背景大小为 960×640；Label 显示 “Hello, World!”。该时点 `cc.view.getScaleX/Y()` 均为 2；记录未单独归因于浏览器尺寸或设备像素比。

临时在 Canvas 下创建三项 `Layout.Type.VERTICAL` + `ResizeMode.CONTAINER` 列表，每项由 Label 和 Button 组成。刚创建时三个子节点位置都为 (0,0)，Layout `_layoutDirty=true`、容器高度 0；下一次 `EVENT_AFTER_DRAW` 已排列到 y≈58.4、0、−58.4，容器高度变为 187.2。该时点 `_layoutDirty` 仍为 true；本次打点不足以判断是哪次回调再次标脏，不能把一次 AFTER_DRAW 解释成所有 UI 脏标志必然清空。真实鼠标点击屏幕上的 Item 1 后，节点 `click` 回调收到索引 1。轨迹见[2.4 UI 记录](../agent-foundation/traces/2.4.15-ui-system.jsonl)。

本轮追加在 Canvas 下创建三项 `260×54` 子节点、间距 10、四边 padding 10 的垂直容器。三项时位置 `[64,0,-64]`、容器 `300×202`；加第四项的即时读数仍为旧位置/尺寸且 `_layoutDirty=true`，调用 `updateLayout()` 后位置 `[96,32,-32,-96]`、容器 `300×266`。`removeAllChildren()` 后以及再调用 `updateLayout()` 后，尺寸都保留 `300×266`、`_layoutDirty=true`，符合源码“空列表不进入 `_doLayout()`”分支。临时根节点销毁后 `cc.isValid(root)` 为 false。完整读数见[2.4 UI 记录](../agent-foundation/traces/2.4.15-ui-system.jsonl)。

另以 `cc.view.setDesignResolutionSize(1280,720,SHOW_ALL)` 直接改变 View 设计尺寸：浏览器帧仍为 960×640，View 的 design/visible size 变为 1280×720、scale 从 2 变为 1.5；Canvas 仍为 960×640、位置 (480,320)，背景 Widget 也仍为 960×640、位置 (0,0)。同步读数和一个 `EVENT_AFTER_UPDATE` 后相同；本次只观测到 `design-resolution-changed`，未观测到 `canvas-resize`。把尺寸和策略恢复为 960×640/FIXED_HEIGHT 后，View/Canvas/背景回到初始读数，并重载预览清除临时监听器。该结果对应源码的运行时接线：WidgetManager 的每帧刷新会排已有活动 Widget，但触发 resize 标脏的运行时监听源是 `canvas-resize`；单独调用 View setter 不等于实际 Canvas/window resize。

另在隔离的无头 Chrome 中打开同一 2.4 Web 预览，使用软件图形后端，设计尺寸与 Canvas CSS 均为 960×640、设备像素比 1。仅在页面内存中创建带 Mask 的 240×200 View、240×500 Content、200×80 Button 子项；关闭弹性和惯性，未挂 ScrollBar。CDP 鼠标轻点得到 `item:touchstart → scroll:touch-up → button:click → item:touchend`，Content 不动。向上拖动 4、14、50 像素后 Content y 依次 104、114、150；14 像素时模拟取消子 Button，未触发 click；松手发 `touch-up → scroll-ended`。一次滚轮事件使 Content y 从 125 到 137，随后发 `scroll-ended`，但 `_scrolling` 留在 true。逐帧与逐事件读数见[2.4 ScrollView Web 轨迹](../agent-foundation/traces/2.4.15-scrollview-web.jsonl)。探针只存在于隔离浏览器，未修改工程文件。真实窗口/Canvas resize、ScrollBar、弹性惯性、嵌套滚动和 Native 仍需单独验证。

## 游戏开发中的定位顺序

UI 位置不对时先确认 Canvas 的设计分辨率和 Fit 策略，查看 `cc.view` 的可见区域，再检查目标 Widget 的对齐目标、四边/中心开关与 `alignMode`；随后检查父 Layout 的类型、Resize Mode、子节点活动状态与尺寸。按钮可见但不响应时再追 Node 命中、Button.interactable/pressed 和事件传播；ScrollView 内按钮要额外检查 View/Content、Mask、边界及 ScrollView 对触摸的捕获。

编辑器本体的场景面板布局操作不在本地引擎源码内；本篇记录的是运行时和 Hello World 预览。2.4 Native、字体缓存的具体渲染后端与复杂滚动列表尚未运行验证。
