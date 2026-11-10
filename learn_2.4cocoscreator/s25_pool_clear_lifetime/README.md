# 第 25 课：清池与节点存活

**目标：** 理解池数组清空与节点实际销毁/存活之间的关系。

## 本课内容

Creator 的 `destroy()` 延迟到帧末处理；池外 JavaScript 变量仍持有句柄也不会取消销毁请求。

代码入口：[main.ts](src/main.ts)、[CCNodePool.ts](src/extensions/ccpool/CCNodePool.ts)。

## 源码位置

- 引擎 [clear()](<../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L100>) 调用节点销毁；销毁队列实现见 [CCObject](<../../engine/2.4.15engine/cocos2d/core/platform/CCObject.js>).

## 简化与运行

本目录是独立代码快照；引擎没有提供的策略由课程应用层实现。

~~~sh
deno task check
deno task build
deno task serve
~~~
