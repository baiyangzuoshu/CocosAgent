# 第 6 课：场景加载后的节点激活

**目标：** 看清 Director 启动场景时，NodeActivator 怎样把本地 `active` 状态传到节点树。

## 本课增量

场景启动后，激活器从 Scene 根节点向下遍历。只有本地 `active` 为真的节点才会进入激活层级。示例把 Canvas 设为未激活，因此 Player 虽然本地 `active` 为真，`activeInHierarchy` 仍为假；同级的 World 保持激活。

## 源码位置

- `engine/2.4.15engine/cocos2d/core/utils/base-node.js:146`、`engine/2.4.15engine/cocos2d/core/utils/base-node.js:278-309`：本地 `_active`、`active` 与 `activeInHierarchy`。
- `engine/2.4.15engine/cocos2d/core/CCDirector.js:173-175`：Director 创建 NodeActivator。
- `engine/2.4.15engine/cocos2d/core/CCDirector.js:476-481`：切换场景后调用 `scene._activate()`。
- `engine/2.4.15engine/cocos2d/core/CCScene.js:96-103`：Scene 把激活请求交给 Director 的 NodeActivator。
- `engine/2.4.15engine/cocos2d/core/node-activator.js:160-200`、`engine/2.4.15engine/cocos2d/core/node-activator.js:244-258`：递归更新节点层级状态。

## 简化

代码按源码职责增加 `NodeActivator`，并保留 `BaseNode → Scene → Director` 的调用关系。为便于每课独立运行，Director 直接提供 `runSceneImmediate()`；组件的 `__preload`、`onLoad`、`onEnable` 和反激活回调留到后续课程。

## 运行

在本课目录运行：

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，页面会显示 `active` 和 `activeInHierarchy`。这是课程精简实现，不依赖完整 Creator 工程。
