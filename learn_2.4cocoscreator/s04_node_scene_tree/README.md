# 第 4 课：节点与场景树

**目标：** 看清 Node 怎样通过父节点和子节点组成场景树。

## 本课增量

本课新增 `BaseNode` 保存 `_parent`、`_children`，`Node` 继承 `BaseNode`，`Scene` 再继承 `Node`。页面创建一棵小树并递归显示层级。

~~~text
Scene: MainScene
├─ Canvas
│  └─ Player
│     └─ Weapon
└─ World
~~~

## 源码对照

- `engine/2.4.15engine/cocos2d/index.js:26`、`engine/2.4.15engine/cocos2d/core/index.js:27-43`：入口加载 Game，再由 core 装配 Node 和 Scene。
- `engine/2.4.15engine/cocos2d/core/platform/CCObject.js:65-87`、`engine/2.4.15engine/cocos2d/core/platform/CCObject.js:580`：基础对象类型注册到 `cc.Object`。
- `engine/2.4.15engine/cocos2d/core/utils/base-node.js:136-146`、`engine/2.4.15engine/cocos2d/core/utils/base-node.js:1349`：`_BaseNode` 继承 `cc.Object` 并注册到 `cc._BaseNode`，保存父子关系。
- `engine/2.4.15engine/cocos2d/core/utils/base-node.js:241-245`：只读 `children` 访问子节点。
- `engine/2.4.15engine/cocos2d/core/utils/base-node.js:348-404`、`engine/2.4.15engine/cocos2d/core/utils/base-node.js:475-485`：查询父节点、设置父节点和添加子节点。
- `engine/2.4.15engine/cocos2d/core/CCNode.js:853-856`、`engine/2.4.15engine/cocos2d/core/CCNode.js:3658-3674`：`Node` 继承 `BaseNode`，并扩展 `addChild`。
- `engine/2.4.15engine/cocos2d/core/CCScene.js:28-40`：`Scene` 继承 `Node`。

## 观察结果

页面显示场景树以及 `Player` 的父节点名称。

## 简化

`CCObject` 是空壳；`BaseNode` 只保留名称和父子数组。节点事件、活动状态、渲染标记、兄弟索引和变换留到后续课程。

## 运行

在本课目录运行：

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>。
