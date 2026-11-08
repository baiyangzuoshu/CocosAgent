# 第 16 课：节点事件传播

**目标：** 看清事件从根节点到目标，再沿父链返回的顺序。

## 本课增量

`NodeEventProcessor.dispatchEvent` 沿父链派发事件。 点中 Player 后，依次显示 `MainScene capture → Branch capture → Player target → Branch bubble → MainScene bubble`。事件保存目标、当前节点和阶段；勾选页面选项可在 Branch 捕获时调用 `stopPropagation()`。

## 源码位置

- `engine/3.8.7engine/cocos/scene-graph/node-event-processor.ts:257-320`：捕获、目标和冒泡阶段。
- `engine/3.8.7engine/cocos/input/types/event/event.ts`：事件的目标、当前节点和传播控制。

## 简化

只处理 touch-start 和固定的父链；支持停止后续节点传播。省略事件类型注册、立即停止同节点监听器、监听器移除、节点销毁和相机命中等细节。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，先点击角色观察完整路径，再勾选停止传播并再次点击。
