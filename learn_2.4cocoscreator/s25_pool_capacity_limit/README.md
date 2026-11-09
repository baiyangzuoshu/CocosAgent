# 第 25 课：对象池容量上限与超额销毁

**目标：** 把池容量限制为 1；池满时，额外节点不入池并销毁。

## 本课增量

点击“回收 EnemyB（容量上限 1）”。示例先把 EnemyA 放入池，再尝试回收 EnemyB。应用层的 putWithinCapacity 在调用 NodePool.put 前读取 size；池满就移除并请求销毁。被丢弃的 EnemyB 不进入对象池，也不会调用池处理器的 unuse。

Creator 2.4 的 NodePool 提供 size、put 和 clear，但没有容量上限；容量限制属于调用方策略。

代码入口：[main.ts](src/main.ts)、[CCNodePool.ts](src/extensions/ccpool/CCNodePool.ts)、[CCObject.ts](src/cocos2d/core/platform/CCObject.ts)。

## 源码位置

- [CCNodePool.js:91](../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L91)：size 返回池内对象数；[put:121](../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L121) 移除父节点、调用 unuse 并加入池，没有容量判断。
- [CCObject.js:305](../../engine/2.4.15engine/cocos2d/core/platform/CCObject.js#L305)：destroy 将对象放入延迟销毁队列。

## 简化与运行

~~~sh
deno task check
deno task build
deno task serve
~~~

页面加载完成后点击容量按钮，观察 size 保持为 1、EnemyB 不入池并进入销毁队列。再点清空对象池观察池内节点销毁。
