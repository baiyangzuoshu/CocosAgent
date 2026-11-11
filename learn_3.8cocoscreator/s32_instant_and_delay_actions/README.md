# 第 32 课：即时回调与延迟动作

**目标：** 看清 CallFunc 何时执行，以及 DelayTime 如何只消耗时间并在结束后移出 ActionManager。

## 本课内容

Node 分别运行一个 CallFunc 和一个 1 秒 DelayTime。浏览器显示回调触发状态、延迟进度和剩余动作数。两种动作彼此独立；串行组合留到第 33 课。

## 源码位置

- 引擎 `cocos/tween/actions/action-instant.ts`：`ActionInstant.step` 在动作更新时调用 `update(1)`；`CallFunc.update` 执行回调。
- 引擎 `cocos/tween/actions/action-interval.ts`：`ActionInterval.step/isDone` 推进并检查时间；`DelayTime.update` 不修改目标属性。
- 引擎 `cocos/tween/actions/action-manager.ts` 与 `cocos/tween/tween-system.ts`：管理动作并接入系统更新。
- Tween 公共入口 `cocos/tween/tween.ts` 的 `call/delay` 最终也建立相应的即时/间隔动作；本课直接加入 ActionManager，省去链式 API。

## 代码与运行

代码入口：[main.ts](src/main.ts)、[action.ts](src/cocos/tween/actions/action.ts)、[action-instant.ts](src/cocos/tween/actions/action-instant.ts)、[action-interval.ts](src/cocos/tween/actions/action-interval.ts)、[action-manager.ts](src/cocos/tween/actions/action-manager.ts)。

简化版只保留单个回调、单个延迟和最小目标接口；省略回调参数、组合动作、缓动、暂停与清理。Cocos2d-x 1.x 的回调发生时机不同，见对应课程。

构建需要 Node 22.13+；脚本使用 Node 内置 TypeScript 类型擦除，不需安装额外依赖。

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>。
