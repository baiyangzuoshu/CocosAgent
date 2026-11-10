# 第 33 课：串行与并行动作

**目标：** 看懂 `Sequence` 如何按时间切分子动作，以及 `Spawn` 如何并行运行并等待较长分支结束。

## 本课内容

`Spawn` 同时运行两条分支：短分支等待 0.25 秒，长分支等待 0.50 秒。短分支完成时只触发自己的回调；并行组结束后，外层 `Sequence` 才触发最后一个回调。

`Sequence` 将总进度按子动作时长切分；`Spawn` 的持续时间取最长分支，并给较短分支串接一个 `DelayTime` 补齐时长。

## 源码位置

- 引擎 `engine/3.8.7engine/cocos/tween/actions/action-interval.ts`：[Sequence 计算切分点](../../engine/3.8.7engine/cocos/tween/actions/action-interval.ts#L284)、[按切分点更新子动作](../../engine/3.8.7engine/cocos/tween/actions/action-interval.ts#L302)、[Spawn 的时长和补齐逻辑](../../engine/3.8.7engine/cocos/tween/actions/action-interval.ts#L793)。
- 引擎 `engine/3.8.7engine/cocos/tween/tween.ts`：[sequence](../../engine/3.8.7engine/cocos/tween/tween.ts#L587) 和 [parallel](../../engine/3.8.7engine/cocos/tween/tween.ts#L602) 将组合动作加入 Tween 链。
- 本课实现：[动作基类](src/cocos/tween/actions/action.ts)、[即时动作](src/cocos/tween/actions/action-instant.ts)、[间隔与组合动作](src/cocos/tween/actions/action-interval.ts)、[演示入口](src/main.ts)。

本课直接构造 `Sequence` / `Spawn`，便于观察动作层；省略 Tween 链式包装、缓动、重复、反向和完整的停止/清理逻辑。

## 运行

需要 Node 22.13+；脚本使用 Node 内置 TypeScript 类型擦除。

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>。
