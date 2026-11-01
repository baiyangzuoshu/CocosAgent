# 第 4 课：节点与场景树

**目标：** 看清 Node 怎样通过父节点和子节点组成 Scene 树。

## 本课增量

本课新增 `Node` 保存 `_parent`、`_children`，`Scene` 继承 `Node`。调用 `addChild()` 建立关系，再递归读取 `children` 显示树形结构。

~~~text
Scene: MainScene
├─ Canvas
│  └─ Player
│     └─ Weapon
└─ World
~~~

## 源码对照

- `engine/3.8.7engine/cocos/scene-graph/node.ts:111-112`：`Node` 继承 `CCObject`。
- `engine/3.8.7engine/cocos/scene-graph/node.ts:372-376`：Node 保存父节点和子节点。
- `engine/3.8.7engine/cocos/scene-graph/node.ts:174-176`、`engine/3.8.7engine/cocos/scene-graph/node.ts:232-237`：读取 `children` 和 `parent`。
- `engine/3.8.7engine/cocos/scene-graph/node.ts:492-543`、`engine/3.8.7engine/cocos/scene-graph/node.ts:624-626`：维护父子关系的 `setParent()` 与 `addChild()`。
- `engine/3.8.7engine/cocos/scene-graph/scene.ts:44-45`、`:88-95`：`Scene` 继承 `Node` 并初始化场景根状态。
- `engine/3.8.7engine/exports/base.ts:36-43`：公开导出 scene-graph 和 game 模块。

## 观察结果

页面显示场景树、`Player` 的父节点，以及继续运行的 Director 帧数。

## 简化

`CCObject`、`Node` 和 `Scene` 只保留本课用到的结构。装饰器、序列化、变换、活动状态、场景渲染对象和激活流程留到后续课程。

## 运行

在本课目录运行：

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>。
