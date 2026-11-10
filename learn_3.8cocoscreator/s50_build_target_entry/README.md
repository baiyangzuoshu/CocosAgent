# 第 50 课：目标选择与构建入口

**本课问题：** Creator 3.8 的目标/模式配置与 `game.ts` 的运行时设置分别由谁负责？

## 观察结果

课程记录 Web Desktop 与 Debug/Release profile；`game.ts` 接收的是运行时设置。旧版 `showFPS`、`frameRate`、`renderMode` 参数会被整理到 `overrideSettings`。本地 3.8 引擎源码不能代表完整 Editor Builder，本课只做静态源码映射和设置转换示例。

## 源码位置

- [`IGameConfig.overrideSettings` 与旧参数说明](../../engine/3.8.7engine/cocos/game/game.ts#L86)；[旧参数转到分类设置](../../engine/3.8.7engine/cocos/game/game.ts#L936)；[帧率从 Screen 设置初始化](../../engine/3.8.7engine/cocos/game/game.ts#L1090)。
- [`game.ts` 依赖内部构建常量](../../engine/3.8.7engine/cocos/game/game.ts#L26)；[平台常量由 `internal:constants` 提供](../../engine/3.8.7engine/cocos/core/platform/macro.ts#L28)。

独立代码：[目标/模式记录](src/build/build-profile.ts)、[运行时参数转换](src/cocos/game/game.ts) 和 [浏览器示例入口](src/main.ts)。

## 简化范围

本课 profile 是课程记录，不还原编辑器构建流程；示例只展示运行时设置对象。没有打开 Creator 3.8 编辑器，也没有进行目标构建或运行验收。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

页面输出 Web Desktop profile 和转换后的 `overrideSettings`。
