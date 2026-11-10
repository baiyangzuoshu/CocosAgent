# 第 39 课：Button 状态与点击回调

**本课问题：** Button 怎样把触摸状态变化变成一次业务回调？

## 观察结果

按住按钮改变为 PRESSED，松开后 clickEvents 计数加一并回到 NORMAL；模拟 TOUCH_CANCEL 只恢复状态，不调用回调。

## 源码位置

- [Button 注册节点事件](../../engine/3.8.7engine/cocos/ui/button.ts#L702)：绑定 TOUCH_START/MOVE/END/CANCEL。
- [Button 触摸状态](../../engine/3.8.7engine/cocos/ui/button.ts#L838)：按下后更新 pressed；移动时按 hitTest 选择过渡状态。
- [点击回调](../../engine/3.8.7engine/cocos/ui/button.ts#L894)：派发 clickEvents 和 Node click。
- [取消处理](../../engine/3.8.7engine/cocos/ui/button.ts#L905)：清除 pressed 后更新状态。
- [Button 状态选择](../../engine/3.8.7engine/cocos/ui/button.ts#L935)：由 interactable、pressed 和 hovered 得到 NORMAL/PRESSED/HOVER/DISABLED。

本课代码按源码职责拆分：[Node 事件订阅](src/cocos/scene-graph/node.ts)、[Button 组件](src/cocos/ui/button.ts)、[入口](src/main.ts)。

## 简化范围

只保留 Node 事件订阅、Button 的按下/取消状态和点击回调。本课复用前课建立的 Node 命中和触摸派发概念；浏览器 Pointer Events 只模拟已命中的节点事件，不实现 Creator InputManager、完整事件传播或渲染。按钮外观由 HTML 控件示意，不是 Creator 引擎渲染。

## 运行

需要 Deno 和 Node.js 22.13 或更新版本。在本目录执行：

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>。
