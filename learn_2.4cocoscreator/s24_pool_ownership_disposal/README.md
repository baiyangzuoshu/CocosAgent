# 第 24 课：对象池所有权与安全关闭

**目标：** 看懂节点的池内所有权、取出顺序、重复入池保护，以及关闭后的终态。

## 本课内容

课程模型在基础 `NodePool` 上增加按身份拒绝重复入池、跨池所有权登记、`put()` 接收结果和 `dispose()` 终态。池仍用数组尾部实现 LIFO。第一次 `dispose()` 清池并关闭对象池；此后 `put()` 返回 `false`、`get()` 返回 `null`，重复关闭安全。

代码入口：[main.ts](src/main.ts)、[CCNodePool.ts](src/extensions/ccpool/CCNodePool.ts)。

## 源码位置

Creator 2.4.15 原生 [NodePool.get/put/clear](../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L100) 提供单池存取与清池；全局所有权表和终态接口是本课新增的课程模型。

## 本课必须保留的机制

保留池尾 LIFO、同节点不重复入池、节点从一个池取出后才可交给另一池、关闭后拒绝操作，以及清池触发延迟销毁。

## 最小观察宿主

单页按钮顺序运行 A/B 取出顺序、重复入池、跨池转交与 dispose 检查，并展示池大小、接收结果和终态。

## 模型化简化与 Creator Runtime 边界

`poolOwners`、布尔返回值及 `dispose/isDisposed` 是课程扩展，不是 Creator 2.4.15 原生 `NodePool` API。这里将它们作为工程安全策略演示，不表示引擎本身带有全局池管理器。

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，点击“运行完整检查”查看所有权和关闭策略。
