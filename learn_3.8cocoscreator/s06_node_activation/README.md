# 第 6 课：场景激活与节点状态

**目标：** 分清节点自身的 `active` 与它在场景树中的 `activeInHierarchy`。

## 本课增量

Director 启动 Scene 时，NodeActivator 从根节点向下遍历。示例将 Canvas 设为未激活，Player 本地 `active` 仍为真，但因为祖先未激活，Player 的 `activeInHierarchy` 为假；World 则正常激活。

## 源码位置

- `engine/3.8.7engine/cocos/scene-graph/node.ts:192-225`：`active`、`activeInHierarchy` 属性。
- `engine/3.8.7engine/cocos/scene-graph/node.ts:1487-1489`：节点换父节点后重新检查层级激活状态。
- `engine/3.8.7engine/cocos/scene-graph/node-activator.ts:158-185`、`engine/3.8.7engine/cocos/scene-graph/node-activator.ts:261-285`：激活节点并递归处理启用的子节点。
- `engine/3.8.7engine/cocos/scene-graph/scene.ts:194-205`：Scene 把激活请求交给 Director 的 NodeActivator。
- `engine/3.8.7engine/cocos/game/director.ts:473-481`：Director 切换场景后调用 `scene._activate()`。

## 简化

代码按源码目录增加 `node-activator.ts`，保留 `Director → Scene → NodeActivator → Node` 的调用链。激活器只处理节点层级状态；源码中的组件预加载、`onLoad`、`onEnable`、事件派发和重入保护留到后续课程。

## 运行

在本课目录运行 `deno task check`、`deno task build` 和 `deno task serve`，然后打开 <http://localhost:8000>。页面会显示每个节点的本地与层级激活状态。
