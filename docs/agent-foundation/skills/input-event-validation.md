# 输入与事件 skill 试用记录

关联候选：[2.4 输入事件追踪](cocos2-input-event-trace/SKILL.md) · [3.8 输入事件追踪](cocos3-input-event-trace/SKILL.md)

## 当前证据

- 按 Cocos Creator 2.4 与 3.8 对应官网手册校准了公开入口、事件作用域、传播和坐标语义。
- 静态跟读了两版 Web 输入路径；另以源码确认 3.8 Native PAL 将触摸消息缓存到 `Director.tick` 的输入派发阶段。
- 两份 skill 均通过本地 `quick_validate.py` 格式校验。
- 2.4.15 示例的 Creator 浏览器预览已运行临时内存探针，轨迹转录在 [`2.4.15-input-events.jsonl`](../traces/2.4.15-input-events.jsonl)。实际浏览器点击验证了父捕获/目标/冒泡、重叠子节点的触摸吞噬与鼠标差异、拖出后 touch cancel，以及两个 Touch 位置坐标。
- 3.8.7 示例的 Creator 浏览器预览也已运行临时内存探针，轨迹转录在 [`3.8.7-input-events.jsonl`](../traces/3.8.7-input-events.jsonl)。验证了 UI 重叠目标的触摸/鼠标拦截、捕获/目标/冒泡、移出命中区域后的 touch cancel，以及屏幕与 UI 坐标。
- 追加的[2.4 收口轨迹](../traces/2.4.15-input-events-completion.jsonl)和[3.8 收口轨迹](../traces/3.8.7-input-events-completion.jsonl)分别验证了重叠节点穿透、自定义 `emit`/`dispatchEvent`，以及 2.4 全局键盘和 3.8 全局 `input`/`systemEvent` 的回调参数与顺序。
- 所有阶段 5 运行实验均来自桌面 Chrome 编辑器预览。Native/小游戏输入桥归阶段 10 实测，3D raycast 归阶段 9；这些结论不能从 Web 轨迹外推。

## 静态案例试用

| 候选 skill | 案例 | 期望路由 | 试用结论 |
| --- | --- | --- | --- |
| 2.x | `node.on(TOUCH_START)` 未触发 | 先查 Node 是否活动、触点是否命中，再查 `CCGame → CCInputManager → CCEventManager → CCNode._hitTest → dispatchEvent`；根据 Web/JSB 区分平台源 | 临时重叠节点探针实测了捕获→目标→冒泡和拖出后的 cancel；只覆盖 2.4.15 浏览器预览。 |
| 2.x | 点击重叠子节点后误以为父节点没有冒泡 | 先查 scene-graph 候选顺序、one-by-one claim 和 `swallowTouches`，再单独查父子捕获/冒泡 | 实测父捕获→顶层目标→父冒泡；下层兄弟未收到 touch start，但收到 mouse down。仅限 2.4.15 这次浏览器预览。 |
| 3.x | 3D 模型没有 Node 点击事件 | 区分 UI `NodeEventProcessor/UITransform.hitTest` 与 3D `input` 坐标、Camera ray 和 PhysicsSystem raycast | 能按手册把 3D 拾取引向全局输入加射线流程，不会误调 2.x API。未在模型场景中运行射线。 |
| 3.x | 点击重叠 UI 时底层节点为什么没有收到事件 | 先检查 PointerEventDispatcher 的相机/sibling 顺序、NodeEventProcessor 的触点认领和 `preventSwallow`；再单独检查父子捕获/冒泡 | 浏览器探针实测上层触摸与鼠标都到达、下层兄弟未收到，父节点仍收到捕获和冒泡。全局 `input` 与 `systemEvent` 顺序没有在此实验测量。 |

两版 UI Node 输入派发、命中、坐标和自定义事件差异已由各自 Web 预览轨迹校验。2.4 普通自定义类型忽略 `useCapture`，3.8 则实测进入父捕获；这一区别已写入版本专属 skill。两版全局入口也有各自 Web 记录，不能当作 Native 或小游戏诊断结论。

## 收口判断与后续边界

阶段 5 的同一开发行为“点击/触摸 UI 节点直到组件回调”已在两版独立源码路径、官方手册和真实 Web 预览中闭环。初次探针与收口探针覆盖默认吞噬、穿透、父子传播、出界取消、坐标、全局入口和自定义事件。2.4 的穿透设置是内部 `_touchListener` 字段实验，不构成公开 API 建议；3.8 的 `preventSwallow` 是手册说明的公开行为。3.8 `systemEvent` 先于直接 `input` 的观测依赖当前桥接初始化与注册顺序，skill 不应将其当作固定优先级保证。

后续阶段 9 在 3D 物体拾取主题测 Camera raycast 和 PhysicsSystem 查询；阶段 10 分别构建并运行 Native/小游戏输入实验，检查平台桥与帧时序。桌面 Web 证据不覆盖这些平台。示例工程、引擎文件均未因阶段 5 探针修改；两页测试后重载以清除内存节点和监听器。
