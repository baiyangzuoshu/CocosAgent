# 第 32 课：即时回调与延迟动作

**目标：** 看清 CallFunc 何时执行，以及 DelayTime 如何只消耗时间并在结束后移出 ActionManager。

## 本课内容

Node 分别运行一个 CallFunc 和一个 1 秒 DelayTime。浏览器显示回调触发状态、延迟进度和剩余动作数。两种动作彼此独立；串行组合留到第 33 课。

## 源码位置

- 引擎 [CCActionInstant.step](<../../engine/2.4.15engine/cocos2d/actions/CCActionInstant.js#L45>) 调用 `update(1)`；[CallFunc.update](<../../engine/2.4.15engine/cocos2d/actions/CCActionInstant.js#L520>) 执行回调。
- 引擎 [DelayTime.update](<../../engine/2.4.15engine/cocos2d/actions/CCActionInterval.js#L2404>) 不修改属性；父类 `step/isDone` 推进和判断时间。
- 引擎 [ActionManager.update](<../../engine/2.4.15engine/cocos2d/actions/CCActionManager.js#L197>) 逐帧执行动作并移除已完成动作；[CCDirector 初始化 ActionManager](<../../engine/2.4.15engine/cocos2d/core/CCDirector.js#L158>) 并将其接入帧循环。

## 代码与运行

代码入口：[main.ts](src/main.ts)、[CCAction.ts](src/cocos2d/actions/CCAction.ts)、[CCActionInstant.ts](src/cocos2d/actions/CCActionInstant.ts)、[CCActionInterval.ts](src/cocos2d/actions/CCActionInterval.ts)、[CCActionManager.ts](src/cocos2d/actions/CCActionManager.ts)。

源码中 CallFunc 首次动作更新时执行，DelayTime 的 `update` 为空。本课省去 Tween 链式 API和属性动作，只保留动作基类、即时/间隔动作及管理器；Cocos2d-x 1.x 的回调时机差异见同主题课程。

构建需要 Node 22.13+；脚本使用 Node 内置 TypeScript 类型擦除，不需安装额外依赖。

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>。
