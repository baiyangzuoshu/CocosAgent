# Creator 2.4.15 源码学习

从这里开始。课程以 Web 浏览器运行时为目标，用 TypeScript 逐课搭建一份精简实现，重点理解引擎的模块边界和调用顺序。

## 学习方式

1. 按编号打开一课，先看本课要解决的问题。
2. 对照课内列出的 Creator 2.4.15 源码位置。
3. 在共同的 src/ 代码上增加本课功能，不为每课复制一份工程。
4. 运行页面，观察本课结果。

每课只增加一层；只裁掉当前 Web 路径无关的代码。课程实现保留源码的目录职责与关键调用关系，不追求完整兼容 Creator。

## 课程目录

- [课程大纲](课程大纲.md)：完整阶段规划与源码文件索引。
- [第 0 课：浏览器入口](s00_web_entry/README.md)：准备最小浏览器宿主。
- [第 1 课：模块装配](s01_module_assembly/README.md)：创建 cc 命名空间并注册第一个模块。
- 下一课：游戏启动与引擎初始化，见课程大纲第 2 课。

## 代码结构

~~~text
learn_2.4cocoscreator/
├── s00_web_entry/             # 每课一个目录，README 说明本课增量
├── s01_module_assembly/
├── src/                       # 逐课累积的 TypeScript 实现
│   └── cocos2d/core/          # 尽量镜像 Creator 源码职责
├── scripts/                   # 课程构建辅助脚本
├── index.html                 # 浏览器宿主页面
└── deno.json                  # 检查、构建、预览命令
~~~

## 运行

在本目录执行：

~~~sh
deno task check
deno task build
deno task serve
~~~

然后打开 <http://localhost:8000>。每课会指出应观察的页面结果和对应源码位置。
