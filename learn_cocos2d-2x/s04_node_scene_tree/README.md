# 第 4 课：Node/Scene 树

**目标：** 用 Scene 作根节点，通过 addChild 建立 parent 和 children。

## 源码位置

- `engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp:595`：CCNode::addChild()：插入子节点并设 parent。
- `engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp:753`：CCNode::insertChild()：写入子节点容器。
- `engine/cocos2d-x-2/cocos2dx/support/data_support/ccCArray.cpp:120`：ccArrayAppendObject()：容器 retain 子对象。
- `engine/cocos2d-x-2/cocos2dx/cocoa/CCObject.cpp:90`：CCObject::retain()：子节点由父节点持有。
- `engine/cocos2d-x-2/cocos2dx/layers_scenes_transitions_nodes/CCScene.cpp:57`：CCScene::create()：创建场景根节点。

## 本课代码

代码放在 `src/`，目录按 `engine/cocos2d-x-2/` 镜像。子节点容器用 std::vector 代替 CCArray，但保留插入时 retain、移除或析构时 release。PoolManager、池数组和 autorelease 计数折叠成一个 pool 的入队/clear。

## 观察结果

打印 Scene → Node#1 → Node#2 → Node#3 的树；释放 Scene 后，父子持有链依次释放。

## 编译运行

在本课目录执行：

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/cocoa/CCObject.cpp src/cocos2dx/cocoa/CCAutoreleasePool.cpp src/cocos2dx/base_nodes/CCNode.cpp src/cocos2dx/layers_scenes_transitions_nodes/CCScene.cpp -o /tmp/cocos2d-2x-s04
/tmp/cocos2d-2x-s04
~~~

这是本课自己的精简实现；没有编译或调用完整引擎。
