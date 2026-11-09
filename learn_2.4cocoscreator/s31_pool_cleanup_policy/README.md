# 第 31 课：回收与清理的区别

**目标：** 分清对象池暂时移出节点与显式清理事件的区别。

## 本课增量

点击“对比回收与 cleanup=true”。`NodePool.put()` 用 `removeFromParent(false)`，节点暂存时触摸监听仍保留；取回挂载后仍能收到事件。随后用 `removeFromParent(true)` 移除同一节点，`cleanup()` 清除监听，重新挂载也不会再触发。

对象池回收是临时离场；`cleanup=true` 清掉节点的动作和事件。

代码入口：[main.ts](src/main.ts)、[CCNodePool.ts](src/extensions/ccpool/CCNodePool.ts)、[base-node.ts](src/cocos2d/core/utils/base-node.ts)、[CCNode.ts](src/cocos2d/core/CCNode.ts)。

## 源码位置

- [CCNodePool.js:124](../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L124)：入池时明确传入 `false`。
- [base-node.js:684](../../engine/2.4.15engine/cocos2d/core/utils/base-node.js#L684) 与 [base-node.js:709](../../engine/2.4.15engine/cocos2d/core/utils/base-node.js#L709)：默认清理；传 `false` 才只移除父子关系。
- [CCNode.js:3683](../../engine/2.4.15engine/cocos2d/core/CCNode.js#L3683)：`cleanup()` 清除动作与节点事件监听，并递归处理子节点。

## 简化与运行

示例实现事件监听清理；省略 ActionManager 和完整系统事件注册。

~~~sh
deno task check
deno task build
deno task serve
~~~

池化后事件数增加；`cleanup=true` 再挂载后事件数保持不变。
