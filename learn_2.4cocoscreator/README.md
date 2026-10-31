# Creator 2.4.15 源码学习

从这里开始。课程以 Web 浏览器运行时为目标，用 TypeScript 逐课搭建一份精简实现，重点理解引擎的模块边界和调用顺序。

## 学习方式

1. 按编号打开一课，先看本课要解决的问题。
2. 对照课内列出的 Creator 2.4.15 源码位置。
3. 直接运行本课目录里的独立代码。
4. 运行页面，观察本课结果。

每课目录都保存一份完整、可运行的代码快照。后一课从前一课增加一层功能，因此既能单独运行，也能看到架构如何逐步长成。代码目录尽量对应 Creator 源码职责，只裁掉当前 Web 路径无关的代码。

## 课程目录

- [课程大纲](课程大纲.md)：完整阶段规划与源码文件索引。
- [第 0 课：浏览器入口](s00_web_entry/README.md)：准备最小浏览器宿主。
- [第 1 课：模块装配](s01_module_assembly/README.md)：创建 cc 命名空间并注册第一个模块。
- [第 2 课：游戏启动](s02_game_startup/README.md)：调用 cc.game.run() 并观察引擎启动事件。

## 代码结构

~~~text
learn_2.4cocoscreator/
├── README.md                  # 课程入口
├── 课程大纲.md
├── s00_web_entry/             # 独立的第 0 课工程
│   ├── README.md
│   ├── deno.json
│   ├── index.html
│   └── src/
├── s01_module_assembly/       # 独立的第 1 课工程，含前课功能
│   ├── README.md
│   ├── deno.json
│   ├── index.html
│   └── src/cocos2d/core/      # 镜像 Creator 的模块职责
└── s02_game_startup/          # 独立的第 2 课工程，含前课功能
    ├── README.md
    ├── deno.json
    ├── index.html
    └── src/cocos2d/core/
~~~

## 运行

进入要学习的课程目录，按该课 README 中的命令检查、构建和运行。每课有自己的 deno.json、index.html 和 src/，不依赖其他课的代码。

课程讲义会列出对应的 Creator 源码路径，路径相对于仓库根目录。
