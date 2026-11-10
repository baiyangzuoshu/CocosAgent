# 第 51 课：代码与引擎构建

**本课问题：** Creator 3.8 怎样用构建常量区分编辑器、预览和发布运行时？

## 观察结果

引擎源码从 `internal:constants` 导入 `BUILD`、`EDITOR`、`PREVIEW` 等常量，再据此走不同运行时代码分支。例如 `Game.run` 在未初始化或 `EDITOR_NOT_IN_PREVIEW` 时提前返回。常量声明能说明分支意图，但本地源码不包含完整 Editor Builder。

## 源码位置

- [`game.ts` 导入内部常量](../../engine/3.8.7engine/cocos/game/game.ts#L26)；[`Game.run` 的运行时分支](../../engine/3.8.7engine/cocos/game/game.ts#L1035)。
- [`EDITOR` 与 `EDITOR_NOT_IN_PREVIEW` 声明](../../engine/3.8.7engine/@types/consts.d.ts#L120)；[`BUILD` 声明](../../engine/3.8.7engine/@types/consts.d.ts#L135)；[运行时模块使用平台常量](../../engine/3.8.7engine/cocos/core/platform/macro.ts#L28)。

独立代码：[常量配置模型](src/build/runtime-constants.ts)、[Game.run 条件模型](src/cocos/game/game.ts) 和 [浏览器输出](src/main.ts)。

## 简化范围

代码只演示构建常量与运行时分支的关系，不重建 Creator 的宏替换或 Editor Builder；没有进行 3.8 编辑器构建或运行验收。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000` 查看发布 profile 的常量与 `Game.run` 判断。
