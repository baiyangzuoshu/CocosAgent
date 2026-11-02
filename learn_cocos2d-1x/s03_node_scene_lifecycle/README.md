# 第 3 课：Scene/Node 生命周期

**目标：** 观察 Scene 调用 Node 的 onEnter/onExit，并沿子节点传播。

## 源码位置

- `engine/cocos2d-x-1/cocos2dx/include/CCNode.h:109`：CCNode 声明。
- `engine/cocos2d-x-1/cocos2dx/base_nodes/CCNode.cpp:932`：CCNode::onEnter()：先遍历子节点。
- `engine/cocos2d-x-1/cocos2dx/base_nodes/CCNode.cpp:955`：CCNode::onExit()：先处理本节点。
- `engine/cocos2d-x-1/cocos2dx/include/CCScene.h:44`：CCScene 声明并继承 CCNode。

## 本课代码

代码放在 `src/`，目录按 `engine/cocos2d-x-1/` 镜像。本课使用栈对象和非拥有子指针，聚焦回调顺序；引用计数与资源清理留到后续课。

## 观察结果

终端按本地源码所示顺序打印 Scene、Canvas、Player 的进入和退出回调。

## 编译运行

在本课目录执行：

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/base_nodes/CCNode.cpp src/cocos2dx/layers_scenes_transitions_nodes/CCScene.cpp -o /tmp/cocos2d-1x-s03
/tmp/cocos2d-1x-s03
~~~

这是本课自己的精简实现；没有编译或调用完整引擎。
