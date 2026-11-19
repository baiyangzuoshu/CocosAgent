# 第 21 课：销毁请求与队列处理

**问题：** `destroy()` 调用返回时，对象是否已经销毁？

## 观察步骤

1. 等 EnemyA、EnemyB 首次 `update` 后再操作。
2. 点“暂存 EnemyA”：`removeChild(false)` 触发停用，但 `isValid` 仍为 true，也没有 `onDestroy`；重新挂载可再次 `onEnable`。
3. 点“销毁 EnemyB”：调用返回后 `isValid` 仍为 true。下一帧状态区保存两次快照：`EVENT_AFTER_UPDATE` 时队列尚未处理；`EVENT_AFTER_FRAME` 时课程销毁队列已处理，`onDisable → onDestroy` 完成且 `isValid=false`。
4. 销毁请求一旦接受，按钮会立即禁用，避免重复请求覆盖观察结果。

## 本课必须保留的机制

- `destroy()` 只把对象排入延迟队列，调用后对象仍有效；重复请求不会再次加入。
- Director 在 update/lateUpdate 阶段之后处理队列。对象销毁时先停用活动组件，再回调 `onDestroy`，随后 `isValid` 才为 false。
- `removeChild(child,false)` 是暂时离开层级，不是销毁；它与 NodePool.put 的“移除但保留实例”效果相似，不是实际使用 NodePool。

## 最小观察宿主

一个活动 Scene、最小 Director 帧循环、两个直接创建的 Enemy、暂存/重挂与 destroy 按钮，以及累积的帧阶段快照。这里不经过 Prefab/instantiate，因为实例化不是本课机制。DOM 在帧回调后才绘制，因此用日志保存队列前后的两个状态，而不是尝试瞬间显示。

## Creator 2.4.15 源码对照

- [CCObject.js](../../engine/2.4.15engine/cocos2d/core/platform/CCObject.js#L290-L320)：`destroy()` 入队与实际销毁。
- [CCDirector.js](../../engine/2.4.15engine/cocos2d/core/CCDirector.js#L880-L905)：真实 Runtime 在 update/lateUpdate 后处理销毁队列，再进入 renderer。
- [node-activator.js](../../engine/2.4.15engine/cocos2d/core/node-activator.js#L203-L240)：停用子树；[CCComponent.js](../../engine/2.4.15engine/cocos2d/core/components/CCComponent.js#L503-L510) 与 [node-activator.js](../../engine/2.4.15engine/cocos2d/core/node-activator.js#L353-L370)：组件销毁与 `onDestroy`。

## 模型化简化与 Creator Runtime 边界

本地 `CCObject` 只实现单一待销毁数组和 `isValid`；节点清理仅覆盖本课需要的子树/组件回调，不实现资源引用计数、编辑器撤销与完整 Runtime 销毁管线。课程 Director 在 `EVENT_AFTER_UPDATE` 后刷新队列，并发出课程自定义 `EVENT_AFTER_FRAME`；它没有 Renderer。对照 Creator Runtime 时，“before render”是引擎源码阶段，不是本课真的执行了渲染。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~
