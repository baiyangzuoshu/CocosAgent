# 第 1 课：模块导出

**目标：** 看清 3.8 怎样用 ES 模块导出 API，同时保留 `cc` 兼容命名空间。

## 本课增量

`exports/base.ts` 先导入预定义，再从 `cocos/game/index.ts` 重导出 `Game`、`Director` 和两个单例。模块创建单例时，也把它们登记到 `cclegacy`。

~~~text
src/main.ts
  → src/exports/base.ts
    → src/predefine.ts
      → src/cocos/core/global-exports.ts
    → src/cocos/game/index.ts
      → game.ts / director.ts
~~~

## 源码对照

- `engine/3.8.7engine/exports/base.ts:26-43`：预定义先于模块导出，之后导出 `cocos/game`。
- `engine/3.8.7engine/predefine.ts:26-28`：预定义模块取得 legacy 命名空间。
- `engine/3.8.7engine/cocos/core/global-exports.ts:36-74`：创建 `cclegacy`，并设置浏览器全局 `cc` 与 `CocosEngine`。
- `engine/3.8.7engine/cocos/game/index.ts:26-30`：重导出 Director 和 Game。
- `engine/3.8.7engine/cocos/game/game.ts:1190-1199`、`director.ts:948-955`：导出类和单例，并登记到兼容命名空间。

## 观察结果

页面从 `exports/base.ts` 取得 `game` 和 `director`；`window.cc.game`、`window.cc.director` 指向同一批单例。

## 简化

这里只实现 Game、Director 的空壳和导出顺序。`exports/base.ts` 其余渲染、资源、输入等公开模块尚未加入。

## 运行

在本课目录运行：

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>。
