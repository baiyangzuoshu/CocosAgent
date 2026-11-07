# 第 0 课：浏览器入口

**目标：** 让浏览器加载由 TypeScript 转成的 JavaScript。

**index.html** 加载 **dist/src/main.js**；构建任务将 **src/main.ts** 转换到这里。页面显示“TypeScript 入口已在浏览器中运行。”时，本课完成。

在 learn_2.4cocoscreator 目录中运行：

~~~sh
deno task check
deno task build
deno task serve
~~~

然后打开 <http://localhost:8000>。Deno 负责类型检查和 TS 转换；Python 提供静态页面服务。这些工具已安装在当前环境，无需添加项目依赖。

**工具说明：** 当前 Deno 的 transpile 命令报告为实验性；此课先使用本机工具，后续可以替换构建命令。

**源码对照：** 本课只搭浏览器宿主，尚未实现引擎模块。下一课从 engine/2.4.15engine/index.js 和 cocos2d/core/predefine.js 开始对照模块装配。
