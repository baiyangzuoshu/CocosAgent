# 第 3 课：Scene/Node 生命周期

**目标：** 观察 Scene 调用 Node 的 onEnter/onExit，并沿子节点传播。

## 源码位置

- `engine/cocos2d-x-3/cocos/2d/CCNode.h:109`：Node 声明。
- `engine/cocos2d-x-3/cocos/2d/CCNode.cpp:1312`：Node::onEnter()：先调用本节点回调。
- `engine/cocos2d-x-3/cocos/2d/CCNode.cpp:1400`：Node::onExit()：先调用本节点回调。
- `engine/cocos2d-x-3/cocos/2d/CCScene.h:70`：Scene 声明并继承 Node。

## 本课代码

代码放在 `src/`，目录按 `engine/cocos2d-x-3/` 镜像。本课使用栈对象和非拥有子指针，聚焦回调顺序；引用计数与资源清理留到后续课。

## 观察结果

终端按本地源码所示顺序打印 Scene、Canvas、Player 的进入和退出回调。

## 编译运行

在本课目录执行：

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/2d/CCNode.cpp src/cocos/2d/CCScene.cpp -o /tmp/cocos2d-3x-s03
/tmp/cocos2d-3x-s03
~~~

这是本课自己的精简实现；没有编译或调用完整引擎。
