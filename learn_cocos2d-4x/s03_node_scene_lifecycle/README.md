# 第 3 课：Scene/Node 生命周期

**目标：** 观察根 Scene 调用 `Node::onEnter()`、`Node::onExit()` 时，回调怎样沿子节点传播。

## 源码位置

- `engine/cocos2d-x-4/cocos/2d/CCNode.cpp:1271`：`Node::onEnter()` 执行本节点逻辑后遍历子节点。
- `engine/cocos2d-x-4/cocos/2d/CCNode.cpp:1359`：`Node::onExit()` 执行本节点逻辑并向子节点派发离场。
- `engine/cocos2d-x-4/cocos/2d/CCScene.h:70`：`Scene` 继承 `Node`，可作为场景树根节点。
- 完整生命周期背景见[4.0 Scene、Node 与对象生命周期源码追踪](../../docs/cocos2d-x/02-objects-and-lifecycle.md)。

## 本课代码

示例建立 `MainScene → Canvas → Player`，显式调用 Scene 的 `onEnter()` 和 `onExit()`。Scene 继承 Node 的实现，Node 再依次调用子节点的同名方法。

## 观察结果

进入时按 `MainScene`、`Canvas`、`Player` 顺序打印；退出时也先打印父节点，再沿子节点向下传播。

## 简化

本课用栈对象和非拥有子指针聚焦回调顺序，不实现 `Ref` 所有权、Component 回调、Scheduler、暂停恢复和场景转场。对象引用在[第 2 课](../s02_object_reference/README.md)说明，完整引擎还会结合父子引用管理节点生命周期。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/2d/CCNode.cpp src/cocos/2d/CCScene.cpp -o /tmp/cocos2d-x-4-s03
/tmp/cocos2d-x-4-s03
~~~
