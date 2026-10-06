# 3.8.7 UI 系统

本篇以 [3.8 UI 系统](https://docs.cocos.com/creator/3.8/manual/zh/2d-object/ui-system/index.html)、[Canvas](https://docs.cocos.com/creator/3.8/manual/zh/ui-system/components/editor/canvas.html)、[UITransform](https://docs.cocos.com/creator/3.8/manual/zh/ui-system/components/editor/ui-transform.html)、[Widget](https://docs.cocos.com/creator/3.8/manual/zh/ui-system/components/editor/widget.html)、[Layout](https://docs.cocos.com/creator/3.8/manual/zh/ui-system/components/editor/layout.html)、[ScrollView](https://docs.cocos.com/creator/3.8/manual/zh/ui-system/components/editor/scrollview.html)、[Button](https://docs.cocos.com/creator/3.8/manual/zh/ui-system/components/editor/button.html)、[多分辨率适配](https://docs.cocos.com/creator/3.8/manual/zh/ui-system/components/engine/multi-resolution.html)和[动态列表](https://docs.cocos.com/creator/3.8/manual/zh/ui-system/components/engine/list-with-data.html)为公开行为基线。源码快照为 `3.8.7engine`；`3.8,7NewProject` 的 `main.scene` 没有 Canvas、Layout、Button 或 Label，因此以下结构结论主要来自源码。阶段 7 在 Web 示例中临时创建 Canvas/UITransform、UI Camera、垂直 Layout、Label、Button 与 ScrollView，已测得列表动态增删、空容器、按钮轻点和最小滚动手势。直接 View 分辨率探针及临时 Canvas Widget 已覆盖同步变化和下一帧对齐；真实窗口 resize 仍待测。原先 Graphics/Label/Button 探针未触发回调的原因仍待定位。

## UI 根与空间

3.8 的 UI 尺寸和锚点由 `cocos/2d/framework/ui-transform.ts::UITransform` 管理，Node 保留层级与三维变换。`Canvas` 继承 `RenderRoot2D`；后者在启用时向 `Root.batcher2D` 注册一个 2D 数据收集根。场景可有多个 Canvas。Canvas 与 Camera 不一一对应：UI 是否绘制仍由 Node layer 和 Camera visibility 决定。`Canvas.cameraComponent` 只表示要与 Canvas 对齐的 Camera；`alignCanvasWithScreen` 决定 Canvas 是否同步调整该相机的位置和正交高度。不要把 2.4 Canvas 自动创建默认相机的规则带到 3.8。

设计分辨率与 Fit 策略在项目设置中定义。运行时 `cocos/ui/view.ts::View.setDesignResolutionSize` 计算 scale、viewport 和 visibleRect，并发 `design-resolution-changed`；窗口变化另发 `canvas-resize`。`Canvas._onResizeCamera` 只在有关联 Camera 且启用对齐时调整相机。`cocos/ui/widget-manager.ts` 在场景启动、每帧 `AFTER_UPDATE` 及窗口/Canvas resize 后处理 Widget；`Widget.updateAlignment()` 可立即对齐自身及祖先链。3.8 的 Widget 根据 `UITransform` 的尺寸、锚点及 Node 变换调整目标。`ONCE`、`ON_WINDOW_RESIZE`、`ALWAYS` 的刷新时机要结合目标节点与屏幕事件判断。

这里的事件接线与 2.4 不同：3.8 WidgetManager 直接监听 `View` 的 `design-resolution-changed`，遍历场景并把 `ON_WINDOW_RESIZE` 和 `ALWAYS` Widget 标脏；`AFTER_UPDATE` 只对脏 Widget 调用 `align`。`Canvas` 也监听设计分辨率变化，但 `_onResizeCamera` 仅处理关联相机的正交高度与世界位置。临时创建四边拉伸 `ON_WINDOW_RESIZE` Widget 的实测中，View setter 同步返回时 Canvas 尺寸仍是 960×640、位置 (480,320)，Widget 已标脏；下一个 `AFTER_UPDATE` 后 Canvas UITransform 成为 1280×720、位置变为 (640,360)，Widget 清洁。恢复 960×640 后下一帧回到原值。调整设计分辨率后若 UI 没有更新，应分别检查 View、Widget 的脏标记、Canvas 对齐和相机可见层，而不是只检查 Canvas 组件。

## 排版、文字、按钮和滚动

```text
项目设置/运行时 View 设计分辨率
  → View scale/visibleRect，Canvas 与 WidgetManager 对齐
  → Layout 监听子节点增删、尺寸与变换，AFTER_UPDATE 更新位置/容器大小
  → Label.string 标记 RenderData 待更新
  → UIRenderer → Batcher2D 的 assembler/批次 → 当前渲染管线
  → PointerEventDispatcher/UITransform.hitTest → Button.touch end → click 事件
```

`cocos/ui/layout.ts::Layout.updateLayout(force)` 仅在脏标记或 `force=true` 时执行；`_checkUsefulObj` 只纳入活动且具有 UITransform 的子节点。子节点增删、尺寸、锚点、变换和活动状态会触发重新布局。若游戏逻辑在同一帧需要最终坐标，可显式调用 `updateLayout()`；否则通常等 `DirectorEvent.AFTER_UPDATE`。

源码还给出一个空列表边界：3.8 的 `updateLayout()` 在脏标记成立时即进入 `_doLayout()`，即使没有可用子节点；垂直/水平 `CONTAINER` 大小由 padding 与 spacing 公式计算。这个公式在零子节点时包含 `(count - 1) * spacing`，所以不能假定结果等于零或只等于 padding。本例上下 padding 各 10、spacingY=10，空列表高为 10；与 2.4 的空列表直接跳过相比，这是明确的控制流差异。2.4 空列表显示尺寸尚待相同条件的预览验证。

`cocos/2d/components/label.ts::Label.string` 改值后标记 RenderData 待更新。Label 的字体、Overflow 与排版设置可能改变 UITransform 尺寸，并进一步触发父 Layout；不能在刚设 `string` 后假设布局与渲染都已完成。`cocos/ui/button.ts::Button` 订阅节点触摸/鼠标事件，按下后在 `TOUCH_END` 发 `clickEvents`，再发节点 `ButtonEventType.CLICK`。底层点击命中与坐标路径见[阶段 5 输入研究](05-input-and-events.md)。

官方 [3.8 ScrollView 手册](https://docs.cocos.com/creator/3.8/manual/zh/ui-system/components/editor/scrollview.html)描述 View、Content、Mask 与可选 ScrollBar；Content 可由 Widget 或 Layout 管理，手册建议二者不要同时挂在同一节点。源码 `cocos/ui/scroll-view.ts` 在捕获阶段订阅触摸事件，Content/View 尺寸变化时重算边界；`_calculateBoundary()` 会先调用启用 Layout 的 `updateLayout()`，再按 View 的 UITransform 尺寸计算。`cancelInnerEvents=true` 时，UI 坐标位移超过 7 个单位后首次拖动向原目标派发模拟 `TOUCH_CANCEL`，源码注明阈值尚未按 DPI 换算；嵌套 ViewGroup 会单独识别。本地 Web 探针已测得累计 14 单位移动后的模拟取消，其他设备阈值及嵌套行为仍待测。

3.8 的 `_handleMoveLogic()` 先把节点本地轴向位移累加到 `_deltaAmount`；组件 `update(dt)` 再消费累加量，调用 `_processDeltaMove()` 更新 Content 与速度样本，并清零增量。因此 3.8 的触摸 MOVE 捕获与 Content 位移应用分属事件回调和组件更新两个时点；自动惯性/回弹时则由同一 `update(dt)` 推进自动滚动。松手时先根据速度样本尝试弹性回边，否则按 `inertia`/`brake` 启动惯性。Web 探针里首次子项 `touch-move` 读到旧 y=100，之后同帧 `scroll-began`/`scrolling` 才读到 y=104；Native 时序仍需打点。

鼠标滚轮由 `MOUSE_WHEEL` 捕获回调处理，垂直方向优先；源码固定使用 `-0.1` 系数，把位移加到 `_deltaAmount`，由 `update(dt)` 应用。对照 2.4，3.8 这里没有显式 Firefox/Windows 或 JSB 系数分支。3.8 还订阅 `HANDLE_INPUT`/`GAMEPAD_INPUT`，但 `_dispatchEventHandleInput()` 只有启用 XR 且鼠标悬停在对应左右 XR 区域时才读取摇杆；普通键盘或手柄不会因此自动变成 ScrollView 滚动输入。普通游戏输入与 ScrollView 滚轮应分别追踪。

在 `update(dt)` 消费位移后，`_scrollChildren()` 对第一次实际滚动发送 `scroll-began`，每次位移发送 `scrolling`，到达边界时发送 `scroll-to-*`。`_dispatchEvent()` 为边界事件维护去重位掩码，到 `scroll-ended` 才清空。触摸 END 先发 `touch-up`，随后处理松手速度、回弹和惯性；自动滚动接近终点时发 `scroll-ended-with-threshold`，最终发 `scroll-ended`。滚轮停止/超时仅在 `_scrolling=true` 且未继续自动滚动时发送 `scroll-ended` 并重置 `_scrolling=false`；Web 探针已测到该状态。25 像素拖动松手得到 `touch-up → scroll-ended`；50 像素拖动松手得到真实 `TOUCH_CANCEL`，没有 `touch-up`，具体输入派发原因仍需进一步定位，不能仅凭屏幕位移断定指针已移出随 Content 移动的子项。快速松手、边界、惯性和 Native 时序尚未验证。

公开的 `ScrollView.EventType`/`ScrollViewEventType` 成员是字符串（如 `SCROLL_BEGAN='scroll-began'`），可用于节点监听；组件 `scrollEvents` 在 `_dispatchEvent()` 内仍经私有 `eventMap` 转成数字索引交给 `ComponentEventHandler`。编写 agent 生成事件代码时应区分节点订阅和编辑器事件列表，不能套用 2.4 的数字枚举值。

## Web 预览探针

在 Creator 3.8.7 的 `3.8,7NewProject` Web 预览（桌面 Chrome，设计分辨率 960×640）中，原场景没有 Canvas。DevTools 仅在运行时创建了独立 Canvas、UI Camera 和垂直 Layout；UITransform 由 3.8 类注册表取得，未改工程文件。3 个 260×54 子项、间距 10、四边 padding 10，手动调用 `Layout.updateLayout()` 后子项 y 坐标依次为 64、0、−64，280×0 的容器变为 280×202。添加第四项后的同步读数仍为旧位置/尺寸且 `_layoutDirty=true`；手动更新后变为 y=`[96,32,-32,-96]`、容器高 266。清空列表后布局仍标脏；手动更新后空容器高度为 10（上下 padding 20 加 `(0-1)*spacingY`）。Graphics/Label/Button 探针将 UI 绘制到示例 3D 场景，但两次点击未触发 Button 回调。后续最小 Canvas/Button 探针改为在 Button 节点上同时记录 `TOUCH_START`、`TOUCH_END` 和 `ButtonEventType.CLICK`，中心鼠标点击三者均收到，Button click 计数为 1。将 Main Camera 可见层先限制为 `DEFAULT` 再恢复原掩码（含 `UI_2D`）后，点击均成功，因此 Main Camera 可见层不是该最小案例的阻断条件；先前失败探针的具体接线差异仍未定位。完整记录见[3.8 UI 轨迹](../agent-foundation/traces/3.8.7-ui-system.jsonl)。

随后重载了 3.8 Web 预览以销毁所有临时节点，并确认场景中没有 `S7*` 探针节点、Main Camera 可见层恢复原值；未写入 `main.scene` 或项目资源。直接改 View 设计分辨率的旧尝试曾触发上下文重建；本轮记录到 960×640/FIXED_HEIGHT → 1280×720/SHOW_ALL：scale 从 `[2,2]` 变为 `[1.5,1.5]`，visibleSize 与设计尺寸同步变为 1280×720，`design-resolution-changed` 同步发出，随后 `AFTER_UPDATE` 可观察到同一组指标；没有 `canvas-resize`。在同一预览临时加四边拉伸的 Canvas Widget 后复测：setter 同步阶段旧 Canvas 尺寸不变且标脏，下一次 `AFTER_UPDATE` 尺寸与位置才更新；反向恢复也在下一帧完成。探针恢复 960×640/FIXED_HEIGHT 后重载，确认无 `S7*` 节点且场景 Canvas/Widget 数量均为 0。先前 Button 探针失败的具体原因仍待查。

另在隔离的无头 Chrome 中打开 3.8 Web 预览，以软件图形后端在页面内存中创建 UI_2D Canvas、对齐屏幕中心的 UI Camera、带 Mask 的 240×200 View、240×500 Content、200×80 Button 子项；关闭弹性和惯性，未挂 ScrollBar。首次相机未对齐时 `UITransform.hitTest()` 为 false，修正并等待相机更新后变为 true，随后的鼠标轻点得到 `item:touch-start → scroll:touch-up → button:click → item:touch-end`。向上拖动 4、14、25 像素时，子项 MOVE 依次读到 Content y=100、104、114，之后更新阶段才移动到 104、114、125；14 像素时有模拟取消，Button 无 click。滚轮使 Content y 从 125 到 175，发送 `scroll-ended` 后 `_scrolling=false`。逐帧记录见[3.8 ScrollView Web 轨迹](../agent-foundation/traces/3.8.7-scrollview-web.jsonl)。本次仅验证桌面 Web 的无 ScrollBar、无惯性最小案例；工程文件未修改。

游戏开发定位时，先确认 RenderRoot2D/Canvas、UITransform 尺寸与 Camera layer/visibility，再查 View 策略、Widget、Layout/Label 脏标志，最后查 Button 与 ScrollView 的输入吞噬。`Root.batcher2D` 只处理 UI 渲染数据；Button/Layout/Widget 本身不等于可见 Sprite。Native 与小游戏屏幕适配和输入时序不能从桌面 Web 路径外推。
