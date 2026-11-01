# 第 0 课：浏览器入口

**目标：** 让浏览器运行由 TypeScript 转换的 JavaScript。

## 本课增量

index.html 加载 dist/src/main.js；构建任务将 src/main.ts 转换到这里。页面显示“3.8.7 课程入口已运行。”时，本课完成。

## 运行

进入本课目录运行：

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>。Deno 负责类型检查和 TS 转换，Python 提供静态页面服务。当前 Deno 的 transpile 命令会提示实验性；本课沿用本机已有工具，不添加项目依赖。

## 源码对照

本课只准备浏览器宿主，尚未实现引擎模块。Creator 3.8.7 的 Web 构建模板通过 SystemJS 加载 `cc`，再创建并启动 Application。课程先只保留浏览器页面和 TypeScript 入口。下一课从以下文件开始：

- engine/3.8.7engine/templates/web-desktop/index.js.ejs:2-16
- engine/3.8.7engine/templates/launcher/application.ejs:9-36

本课代码独立放在本目录的 src/、index.html 和 deno.json 中，不依赖其他课程。
