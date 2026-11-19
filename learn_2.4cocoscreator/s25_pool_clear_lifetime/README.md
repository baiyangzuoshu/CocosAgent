# 第 25 课：清池与节点存活

**目标：** 理解池数组清空与节点实际销毁/存活之间的关系。

## 本课内容

Creator 2.4.15 在 update/lateUpdate 之后、render 之前处理 `destroy()` 队列；池外 JavaScript 变量仍持有句柄也不会取消销毁请求。

代码入口：[main.ts](src/main.ts)、[CCNodePool.ts](src/extensions/ccpool/CCNodePool.ts)。

## 源码位置

- 引擎 [clear()](<../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L100>) 调用节点销毁；销毁队列实现见 [CCObject](<../../engine/2.4.15engine/cocos2d/core/platform/CCObject.js>).

## 本课必须保留的机制

保留 `clear()` 对池内节点发起 `destroy()` 与外部 JavaScript 引用仍持有对象句柄的区别；销毁请求不因池数组清空而撤销。

## 最小观察宿主

保留一个池内节点和一个池外引用，点击清空后在延迟销毁处理前后读取队列状态与 `isValid`。

## 模型化简化与 Creator Runtime 边界

本地 Director/CCObject 只模拟本课所需队列。Creator 2.4.15 在 update/lateUpdate 之后、render 之前处理延迟销毁；本例不替代完整对象递归销毁和引擎运行时资源回收。

~~~sh
deno task check
deno task build
deno task serve
~~~
