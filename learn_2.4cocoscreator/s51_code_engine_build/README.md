# 第 51 课：代码与引擎构建

**本课问题：** Creator 2.4 的引擎源码怎样变成 Web 运行时 JavaScript？

## 观察结果

`buildCocosJs` 接收调用方给出的入口和输出路径；Browserify 解析模块，构建器排除默认跳过项和指定模块，再用构建宏压缩代码、优化并写出 bundle。它展示的是引擎代码 bundle 流程，不是完整 Creator Editor Builder。

## 源码位置

- [`buildCocosJs` 的 bundle、宏压缩与写出](../../engine/2.4.15engine/gulp/tasks/engine.js#L108)；[默认模块排除](../../engine/2.4.15engine/gulp/tasks/engine.js#L121)；[模块排除的依赖展开](../../engine/2.4.15engine/gulp/tasks/engine.js#L499)。
- [`createBundler` 将入口交给 Browserify](../../engine/2.4.15engine/gulp/util/create-bundler.js#L150)；[构建宏定义](../../engine/2.4.15engine/gulp/util/utils.js#L8)。
- [引擎模块清单](../../engine/2.4.15engine/modules.json)；[完整 Builder 的证据边界](../../docs/2.x/10-publishing-and-native.md#L18)。

独立代码：[引擎 bundle 阶段模型](src/build/engine-bundle-plan.ts) 和 [浏览器输出](src/main.ts)。

## 简化范围

示例只打印构建阶段，不运行 Browserify、Terser 或 Creator Editor。入口/输出路径是占位符，因为 `buildCocosJs` 由调用方传入；本课不还原编辑器怎样选择项目入口。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000` 查看阶段顺序。
