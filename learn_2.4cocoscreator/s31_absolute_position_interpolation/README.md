# 第 31 课：时间进度与绝对目标插值

**目标：** 看清时间进度如何把节点从当前横坐标移动到指定的绝对终点。

## 本课递进

两个节点从不同位置出发，各运行 2 秒的 Tween.to({ x: 220 })。动作开始时分别捕获当前位置，再按 0 到 1 的进度插值；最后两个节点都到达 x=220。Cocos2d-x 的第 6 课已讲过 MoveBy，本课聚焦 MoveTo 对绝对终点的处理。

## 源码位置

- 引擎 [ActionInterval.step](<../../engine/2.4.15engine/cocos2d/actions/CCActionInterval.js#L147>) 将经过时间归一化后传给 update。
- 引擎 [MoveTo.startWithTarget](<../../engine/2.4.15engine/cocos2d/actions/CCActionInterval.js#L1179>) 复用 MoveBy 并在动作开始时计算位移差。
- 引擎 [Tween.to](<../../engine/2.4.15engine/cocos2d/actions/tween.js#L491>) 建立绝对值动作；[Tween.start](<../../engine/2.4.15engine/cocos2d/actions/tween.js#L261>) 将动作加入 Director 的 ActionManager。
- 引擎 [CCDirector 初始化 ActionManager](<../../engine/2.4.15engine/cocos2d/core/CCDirector.js#L158>)，并交给 Scheduler 每帧更新。

## 代码与运行

代码入口：[main.ts](src/main.ts)、[CCActionInterval.ts](src/cocos2d/actions/CCActionInterval.ts)、[tween.ts](src/cocos2d/actions/tween.ts)。

本课只处理水平位置和一个 Tween.to 动作；省略 easing、动作组合、暂停与多属性插值。浏览器页面显示两个节点从不同起点移动到同一终点。
构建需要 Node 22.13+；脚本使用 Node 内置 TypeScript 类型擦除，不需安装额外依赖。

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>。
