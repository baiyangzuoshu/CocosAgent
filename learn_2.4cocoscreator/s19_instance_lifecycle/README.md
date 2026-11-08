# 第 19 课：实例挂载与组件生命周期

**目标：** 分清 Prefab 实例化和加入运行中场景：前者创建数据，后者激活节点并触发组件生命周期。

## 本课增量

沿用第 18 课的 Prefab，先创建 EnemyA、EnemyB，检查组件回调仍为空；再把实例加入活动场景。加入时记录 onLoad、onEnable，首个调度阶段记录 start。

## 源码位置

- engine/2.4.15engine/cocos2d/core/platform/instantiate.js:223-285：复制实例对象。
- engine/2.4.15engine/cocos2d/core/utils/base-node.js:1172-1175：父节点变化后检查是否需要激活。
- engine/2.4.15engine/cocos2d/core/node-activator.js:244-252：递归激活并派发 onLoad、onEnable。
- engine/2.4.15engine/cocos2d/core/component-scheduler.js:475-483：在帧调度阶段调用 start。

## 简化

只观察实例加入活动场景的首次激活，省略非活动节点、反复启停、销毁和复杂回调队列。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，挂载前显示无回调；挂载后显示 onLoad → onEnable → start。
