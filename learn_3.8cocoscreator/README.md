# Creator 3.8.7 源码学习

以 Creator 3.8.7 的 Web 浏览器运行时为目标，用 TypeScript 逐课实现一份精简引擎。课程代码按源码职责组织，只保留当前主题需要的部分。

## 学习方式

1. 按编号阅读本课问题和源码位置。
2. 在本课目录运行独立代码。
3. 观察页面结果，再对照引擎源码。

每课都有自己的完整代码快照，不依赖其他课程。源码路径相对于仓库根目录；简化和省略内容在课内说明。

## 课程

- [课程大纲](课程大纲.md)
- [第 0 课：浏览器入口](s00_web_entry/README.md)
- [第 1 课：模块导出](s01_module_assembly/README.md)
- [第 2 课：分阶段启动](s02_game_startup/README.md)
- [第 3 课：Director 与帧调度](s03_director_loop/README.md)
- [第 4 课：节点与场景树](s04_node_scene_tree/README.md)
- [第 5 课：本地位置与世界位置](s05_local_world_transform/README.md)
- [第 6 课：场景激活与节点状态](s06_node_activation/README.md)
- [第 7 课：组件挂载与生命周期](s07_component_lifecycle/README.md)
- [第 8 课：组件每帧调度](s08_component_scheduling/README.md)

## 目录结构

~~~text
learn_3.8cocoscreator/
├── README.md
├── 课程大纲.md
├── s00_web_entry/          # 浏览器加载 TypeScript 入口
├── s01_module_assembly/    # exports/base、模块重导出和兼容命名空间
├── s02_game_startup/       # Game.init 的阶段 Promise 链
├── s03_director_loop/      # Pacer、Game 更新回调和 Director.tick
├── s04_node_scene_tree/    # Node 父子关系和 Scene 树
├── s05_local_world_transform/ # 本地位置与世界位置
├── s06_node_activation/      # Scene 与节点的层级激活状态
├── s07_component_lifecycle/  # Component 挂载与节点激活回调
└── s08_component_scheduling/ # Component 每帧回调调度
~~~

每课进入自己的目录，按 README 运行 `deno task check`、`deno task build` 和 `deno task serve`。
