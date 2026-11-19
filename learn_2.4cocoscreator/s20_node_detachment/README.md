# 第 20 课：Node 与 Component 的启停

**问题：** Node.active、父节点挂载和 Component.enabled 是否是同一个开关？

## 观察步骤

等 EnemyA 首次 `update` 后，分别切换三种状态：

| 操作 | Node.active | activeInHierarchy | Component.enabled | enabledInHierarchy | 典型回调变化 |
| --- | --- | --- | --- | --- | --- |
| `Node.active=false` | false | false | true | false | `onDisable` |
| `Component.enabled=false` | true | true | false | false | `onDisable` |
| `removeChild(A,false)` | true | false | true | false | `onDisable` |

恢复对应条件会再次 `onEnable`。重复移除/重新挂载不会再次调用 `onLoad` 或 `start`。组合按钮会先禁用组件，再移出并重新挂载节点；此时节点回到活动层级，但组件仍禁用，需再次点击恢复组件。

## 本课必须保留的机制

Node 自身 `active` 与继承后的 `activeInHierarchy` 是不同状态；Component 自身 `enabled` 与派生的 `enabledInHierarchy` 也不同。节点变为非活动层级或组件自身被禁用时，调度器调用 `onDisable`；恢复且两个条件都满足才 `onEnable`。`onLoad` 与 `start` 对该实例各执行一次。

## 最小观察宿主

一个活动 Scene、一个 Director 帧循环、EnemyA 与未操作的 EnemyB 对照，以及控制 Node.active、Component.enabled、`removeChild(false)`/重新挂载和组合状态的四个按钮。页面显示状态、最近操作和生命周期日志，不渲染 Sprite。

## Creator 2.4.15 源码对照

- [base-node.js](../../engine/2.4.15engine/cocos2d/core/utils/base-node.js#L709-L710)：`removeChild` 改变父节点；[父节点变化后的激活判断](../../engine/2.4.15engine/cocos2d/core/utils/base-node.js#L1172-L1175)。
- [node-activator.js](../../engine/2.4.15engine/cocos2d/core/node-activator.js#L203-L240)：停用节点树中的组件；[组件激活与加载标记](../../engine/2.4.15engine/cocos2d/core/node-activator.js#L313-L350)。
- [CCComponent.js](../../engine/2.4.15engine/cocos2d/core/components/CCComponent.js#L149-L205)：自身 enabled 与 enabledInHierarchy；[component-scheduler.js](../../engine/2.4.15engine/cocos2d/core/component-scheduler.js#L404-L450)：调度器启停与回调。

## 模型化简化与 Creator Runtime 边界

只演示单个组件、一个场景节点及 `removeChild(child, false)`；不覆盖 cleanup=true 对动作/事件的清理、嵌套节点树、销毁、编辑器与完整 Creator Runtime。页面按钮是观察宿主。组件只有在节点处于活动层级且自身 enabled 时才进入本课调度模型。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~
