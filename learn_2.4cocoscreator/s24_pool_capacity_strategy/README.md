# 第 24 课：对象池容量与预热补充

**目标：** 控制池容量，并用预热和低水位补充平衡创建时机。

## 本课内容

容量、预热和补充都由应用层维护；`NodePool` 只负责存放、取出节点。

代码入口：[main.ts](src/main.ts)、[CCNodePool.ts](src/extensions/ccpool/CCNodePool.ts)。

## 源码位置

- 引擎提供 [size/put/get](<../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L91>) 与 [实例化入口](<../../engine/2.4.15engine/cocos2d/core/platform/instantiate.js>)；容量和补货策略由应用层实现。

## 本课必须保留的机制

容量上限、预热数量与低水位补充由调用方策略控制；NodePool 本身只负责存取节点，不替应用决定何时预建或补货。

## 最小观察宿主

通过容量/预热/补充操作和数值日志观察池大小、可用对象与补建数量；无需输入、资源加载或渲染。

## 模型化简化与 Creator Runtime 边界

本目录是独立代码快照；容量和补货策略是课程应用层模型，不是 Creator NodePool 原生 API。示例未测量真实实例化耗时、Asset 加载或运行时性能。

~~~sh
deno task check
deno task build
deno task serve
~~~
