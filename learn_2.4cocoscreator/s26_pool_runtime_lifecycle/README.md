# 第 26 课：对象池中的节点运行状态

**目标：** 理解节点入池离场、暂停组件调度，以及 cleanup 对节点监听的影响。

## 本课内容

节点移出活动场景后组件 `update` 暂停，重新挂载后恢复；本课用一个节点事件监听器演示 `removeChild(false)` 保留监听、`cleanup=true` 清除监听。当前快照没有 ActionManager，因此不演示动作清理。

代码入口：[main.ts](src/main.ts)、[CCNodePool.ts](src/extensions/ccpool/CCNodePool.ts)。

## 源码位置

- [NodePool.put()](<../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L121>) 移出节点；活动层级和组件调度见 [节点源码](<../../engine/2.4.15engine/cocos2d/core/utils/base-node.js>).

## 本课必须保留的机制

保留节点移出活动层级后组件 `update` 暂停、重新挂载后恢复，以及 `removeChild(false)` 保留节点监听、`cleanup=true` 清理监听的差异。

## 最小观察宿主

用一个组件、一个节点事件监听器和移出/重挂载/清理操作按钮，观察 update 计数与监听回调日志。

## 模型化简化与 Creator Runtime 边界

本目录是独立代码快照，只验证组件调度与 Node 事件监听清理；ActionManager 未纳入此快照，因此不演示动作清理，也不把该结论扩展到动作、音频或其它子系统。

~~~sh
deno task check
deno task build
deno task serve
~~~
