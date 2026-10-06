# UI 系统 skill 验证记录

候选：[2.4 UI 追踪](cocos2-ui-layout-trace/SKILL.md) · [3.8 UI 追踪](cocos3-ui-layout-trace/SKILL.md)。公开行为已按各自官网 UI 手册核对；两版 Canvas、Widget、Layout、Label、Button、ScrollView 的源码入口已定位。

## 已运行

- 2.4.15 Hello World 桌面 Web 预览：读出原场景 Canvas、Widget 和 Label 基线；创建临时三项 `Layout + Label + Button` 列表。创建当刻三个子节点重叠在 y=0，下一次 AFTER_DRAW 时位置已经排开、容器高度为 187.2；真实鼠标点击 Item 1 收到节点 `click`。见[轨迹](../traces/2.4.15-ui-system.jsonl)。列表仅存在于页面内存。
- 2.4.15 同一预览的动态列表补测：三项容器 300×202；增至四项后立即读数仍为旧位置/尺寸且标脏，手动更新后位置 `[96,32,-32,-96]`、容器 300×266。清空后调用 `updateLayout()` 仍保留 300×266、标脏为 true；销毁后 `cc.isValid(root)=false`。这验证了 2.4 空列表直接跳过 `_doLayout()` 的可见结果。
- 3.8.7 3D 示例桌面 Web 预览：DevTools 临时创建 UI Camera、Canvas、UITransform、垂直 Layout/Label/Button 列表。3 项 `updateLayout()` 后 y=`[64,0,-64]`，容器 280×202；添加第 4 项后立即读取仍是旧值且标脏，手动更新后 y=`[96,32,-32,-96]`、容器高 266；清空后手动更新得到空容器高 10。Graphics/Label/Button 绘制成功，但该组合中的两次点击未触发回调。随后独立最小 Canvas/Button 探针记录到 raw `TOUCH_START → TOUCH_END` 和 Button click=1；把 Main Camera 可见层限制到 DEFAULT 或恢复原始掩码（含 UI_2D）都能成功。见[3.8 UI 轨迹](../traces/3.8.7-ui-system.jsonl)。阶段 5 的 UI 输入轨迹另验证了 Node 命中与传播。
- 两版桌面 Web 预览另以隔离无头 Chrome、软件图形后端和 CDP 鼠标事件运行相同尺寸的最小 ScrollView：Mask View 240×200、Content 240×500、Button 子项 200×80，关闭弹性/惯性、不挂 ScrollBar。轻点均触发子 Button click；累计向上移动 14 像素均触发一次 `simulate=true` 的子项 CANCEL，Button 不点击。2.4 第一次 MOVE 同步把 Content y=100 移到 104，滚动事件先于子项 MOVE；3.8 子项 MOVE 先读到旧 y=100，随后更新阶段滚动到 104。关键逐帧事件见[2.4 轨迹](../traces/2.4.15-scrollview-web.jsonl)和[3.8 轨迹](../traces/3.8.7-scrollview-web.jsonl)。探针只在隔离浏览器页面内存中运行，未修改示例工程。
- 滚轮独立复测：两版都先发 `scroll-began → scrolling`、超时后发 `scroll-ended`。2.4 结束后的 `_scrolling=true`，后续拖动可以缺少新 `scroll-began`；3.8 结束后的 `_scrolling=false`。该差异与两版源码的滚轮结束分支一致。CDP `deltaY=100` 在当前浏览器分别使 Content y 增 12、50，不可用于推断其他平台滚轮速度。

## 待验证的具体行为

阶段 7 收口边界：隔离 Chrome 中将真实窗口从 1280×900 缩至 900×650，两版编辑器默认 Web 预览的游戏 Canvas 与 View 仍保持 960×640；这只覆盖默认预览配置，不能证明 Web 构建或全屏适配的表现。用户决定跳过进一步全屏排查，阶段 8 不依赖此项。

1. `setDesignResolutionSize(1280,720,SHOW_ALL)` 的设计尺寸路径已在两版测得。2.4 的 View 变为 1280×720、scale 1.5，但 Canvas/背景 Widget 保持 960×640；只有 `design-resolution-changed`，无 `canvas-resize`。3.8 的四边拉伸 Canvas Widget 在 setter 同步阶段标脏且保持旧尺寸，下一次 `AFTER_UPDATE` 才对齐到 1280×720、位置 (640,360)；恢复同样延后一帧。后续通过真实浏览器窗口 resize 在两版触发窗口尺寸路径，记录 View、Canvas、Widget/Label 尺寸与坐标，恢复原设置。
2. 3.8 最小 Canvas/Button 点击已实测成功；先前 Graphics/Label/Button 布局探针仍有两次点击未触发回调，具体差异未定位。下一步对照两个探针的节点 UITransform、层级、Button enabled/pressed 状态及物理点击点，解释该组合的异常。
3. ScrollView 最小点击、拖动取消与滚轮已完成桌面 Web 打点。仍需分别验证 ScrollBar、边界事件、弹性/惯性近终点事件、嵌套 ScrollView、Content Layout 边界刷新、快速松手以及其他 DPI/Native 平台。3.8 的 50 像素拖动松手在本次探针产生真实 `TOUCH_CANCEL` 而无 `touch-up`，25 像素拖动则得到 `touch-up → scroll-ended`；需沿输入派发路径解释，不能仅凭屏幕位移判断是否越过随 Content 移动的子项边界。

ScrollView 手册与源码交叉检查已完成：两版手册都以 View/Content 为结构核心，源码都在捕获阶段跟踪触摸，并在边界计算前更新启用的 Content Layout；`cancelInnerEvents` 默认开启且源码阈值均为 7、明确标注未按 DPI 换算。实现差异之一是 2.4 以 `getLocation()`/`getStartLocation()` 取值，3.8 使用 UI 坐标接口；3.8 手册另外说明 Content 不应同时使用 Widget 与 Layout。桌面 Web 探针支持该最小取消行为；7 单位不能直接当作跨设备用户可见阈值。

进一步的源码时序差异：2.4 在触摸 MOVE 处理里同步移动 Content；3.8 在 MOVE 回调累加 `_deltaAmount`，由后续 `update(dt)` 消费和移动。相同 4、14、25 像素手势的 Web 回调已经验证这两个位移时点。松手后的弹性回边及按速度样本、`inertia` 与 `brake` 启动的自动滚动尚未运行。

本地引擎没有可直接运行的 ScrollView 专项单元测试：2.4 仅看到 Gulp 的通用测试任务；3.8 `tests/ui/` 有 Button、Widget、UITransform 等测试，但没有 ScrollView 测试。滚轮源码也存在时序/平台系数差异：2.4 滚轮回调内立即移动且有 Windows Firefox、JSB/Runtime 分支；3.8 固定 `-0.1` 并交给 `update(dt)`。3.8 的 HANDLE_INPUT/GAMEPAD_INPUT 订阅实际只在 XR 悬停条件成立时读取摇杆，不能按普通游戏键盘/手柄输入解释。其他平台仍需单独实测。

事件打点需区分 `touch-up`、`scroll-began`、`scrolling`、`scroll-to-*`、`scroll-ended-with-threshold` 和 `scroll-ended`。两版源码都按实际位移启动滚动、同一轮边界事件去重并在结束时清空掩码；桌面 Web 子项范围内松手确认 `touch-up` 先于 `scroll-ended`。2.4 滚轮结束定时回调发 `scroll-ended` 而不清 `_scrolling`；3.8 仅在确实滚动且没有继续自动滚动时发送并清状态。边界与近终点事件需要新增探针。

两个版本的节点事件名均为字符串，但 `cc.ScrollView.EventType` 的公开值不同：2.4 为数字枚举，3.8 为字符串枚举。编辑器 `scrollEvents` 在两版内部都使用数字事件索引映射。本次探针监听 Node 事件；组件 EventHandler 回调仍需独立打点。

两份 skill 当前作为可执行的源码诊断草案。2.4 正常案例“列表排版和 Item 1 点击”已有 Web 实测；3.8 最小 Canvas/Button 点击也已验证，但先前 Graphics/Label/Button 与 Layout 探针未收到回调，需查明两次配置间的差异。易混淆案例“3.8 Canvas 是否自动创建相机”已按 3.8 官方手册和源码正确路由为 Camera Layer/Visibility 条件；“2.4 Label 尺寸变化是否立即排版”应等待布局阶段或调用 `updateLayout()`，不能仅凭设置 string 后的同步值判断。

动态列表、View 直接改设计尺寸和最小 ScrollView 手势现在各有桌面 Web 轨迹。两版技能可用于这些有证据的诊断路径；真实窗口 resize、复杂 ScrollView 分支以及 3.8 旧 Graphics/Label/Button 探针的失败原因仍未完成。没有改动示例工程或引擎源文件。
