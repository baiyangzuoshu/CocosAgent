# 第 26 课：对象池中的节点运行状态

**目标：** 理解节点入池离场、暂停调度，以及 cleanup 对动作和监听的影响。

## 本课内容

节点移出活动场景后组件更新暂停；`cleanup` 决定重新挂载时动作和监听能否保留。

代码入口：[main.ts](src/main.ts)、[node-pool.ts](src/extensions/ccpool/node-pool.ts)。

## 源码位置

- [NodePool.put()](<../../engine/3.8.7engine/extensions/ccpool/node-pool.ts#L126>) 移出节点；活动层级和组件调度见 [节点源码](<../../engine/3.8.7engine/cocos/scene-graph/node.ts>).

## 简化与运行

本目录是独立代码快照；引擎没有提供的策略由课程应用层实现。

~~~sh
deno task check
deno task build
deno task serve
~~~
