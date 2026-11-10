# 第 31 课：时间进度与绝对目标插值

**目标：** 看清 Tween.to 如何在动作开始时读取目标属性，再按时间进度插值到绝对终点。

## 本课递进

两个节点从不同的 x 坐标出发，各运行 2 秒的 Tween.to({ x: 220 })。TweenAction 在 startWithTarget 时捕获起点，ActionInterval 每帧提供 0 到 1 的进度，最后两个节点都到达 x=220。Cocos2d-x 的第 6 课已讲过 MoveBy，本课聚焦绝对目标值。

## 源码位置

- 引擎 [ActionInterval.step](<../../engine/3.8.7engine/cocos/tween/actions/action-interval.ts#L134>) 更新经过时间并计算归一化进度。
- 引擎 [TweenAction.startWithTarget](<../../engine/3.8.7engine/cocos/tween/tween-action.ts#L227>) 捕获属性起点；[update](<../../engine/3.8.7engine/cocos/tween/tween-action.ts#L357>) 按进度插值。
- 引擎 [Tween.to](<../../engine/3.8.7engine/cocos/tween/tween.ts#L475>) 创建绝对值动作；[Tween.start](<../../engine/3.8.7engine/cocos/tween/tween.ts#L329>) 将动作交给 TweenSystem 的 ActionManager。
- 引擎 [TweenSystem.update](<../../engine/3.8.7engine/cocos/tween/tween-system.ts#L76>) 逐帧更新 ActionManager。

## 代码与运行

代码入口：[main.ts](src/main.ts)、[action-interval.ts](src/cocos/tween/actions/action-interval.ts)、[tween-action.ts](src/cocos/tween/tween-action.ts)。

本课只处理水平位置和一个 Tween.to 动作；省略 easing、动作组合、暂停和多属性插值。浏览器页面显示两个节点从不同起点移动到同一终点。
构建需要 Node 22.13+；脚本使用 Node 内置 TypeScript 类型擦除，不需安装额外依赖。

~~~
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>。
