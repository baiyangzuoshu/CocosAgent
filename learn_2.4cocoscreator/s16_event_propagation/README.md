# 第 16 课：节点事件传播

**问题：** 事件命中 Target 后，父链监听器按什么顺序收到它？

## 观察步骤

1. 不勾选停止选项，点击 Target：应看到 `MainScene capture → Branch capture → Target target → Branch bubble → MainScene bubble`。
2. 勾选后再点击：Branch 捕获回调调用 `stopPropagation()`，记录到此结束，Target 与外层冒泡节点不再收到事件。
3. 对照每行：`target` 一直是 Target；`currentTarget` 随正在执行的监听节点变化。

## 本课必须保留的机制

固定父链上的捕获（根到目标父节点）→目标→冒泡（目标父节点回根）顺序；每次调用更新 `currentTarget` 和本地模型的 `phase`；`stopPropagation()` 阻止后续节点继续收到事件。

## 最小观察宿主

一个 canvas 输入面、一个 CSS Target 方框、固定父链 `MainScene → Branch → Target`、五个节点监听器和一个停止传播复选框。输入与 AABB 只负责确定事件目标；文本逐行显示传播记录。

## Creator 2.4.15 源码对照

- [CCNode.js 触摸命中](../../engine/2.4.15engine/cocos2d/core/CCNode.js#L462-L474)：命中后设置 touch-start 与 `bubbles` 并派发。
- [CCNode.js 捕获/冒泡目标收集](../../engine/2.4.15engine/cocos2d/core/CCNode.js#L2455-L2484)：分别沿 parent 收集监听节点。
- [event.js](../../engine/2.4.15engine/cocos2d/core/event/event.js#L134-L160)：`stopPropagation` 和立即停止标记是不同机制。

## 模型化简化与 Creator Runtime 边界

本地模型固定一条三节点父链，只演示 touch-start；本地属性名是 `phase`，不等同于 Creator Runtime 的完整事件对象与内部阶段编号。`stopPropagation()` 在本模型中于当前节点的回调列表执行完后才检查，不实现 `stopPropagationImmediate()`、监听器注册/移除、EventManager 的优先级/claim/swallow 或真实相机命中。本课讲 Node 事件派发，不实现浏览器 DOM 事件冒泡。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~
